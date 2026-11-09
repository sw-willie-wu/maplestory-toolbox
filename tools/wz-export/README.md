# wz-export

把本機台版（TMS）客戶端 WZ 的裝備資料匯出成前端用的靜態 JSON（`public/data/tms-v<版本>/`）。只匯出數值與字串，不匯出圖片。

## 需求

- .NET 8 SDK（`winget install Microsoft.DotNet.SDK.8`；`dotnet --list-sdks` 應列出 `8.x`）
- WzComparerR2 的 WzLib：執行 `fetch-wzlib.ps1` 下載並放進 `lib/`（gitignored）
  - 來源：[Kagamia/WzComparerR2](https://github.com/Kagamia/WzComparerR2)（MIT）release tag `ci-build`
  - **固定版本**：`WcR2_With_Plugins_net8_20261004.1.zip`，SHA-256 `b634c25aaf61bcde3e3fe5f2f49a6d5cab96d8fb6ec3494dae2596bfa55e569e`（腳本會驗證；換版時改 `fetch-wzlib.ps1` 的 `$AssetName`/`$Sha256` 與此處）
  - 只取用 `WzComparerR2.WzLib.dll` 與其執行期依賴 `System.Drawing.Common.dll`（zip 解壓在 `lib/<zip 名>/`）

## 重跑

```powershell
cd tools/wz-export
powershell -ExecutionPolicy Bypass -File fetch-wzlib.ps1   # 第一次或換 WzLib 版本時
dotnet run -- --client "C:\Program Files\gamania Games\MapleStory" --out ../../public/data/tms-v283
```

客戶端版本寫死在 `Program.cs` 的 `ClientVersion`（目前 283）；改版時改它與 `--out` 目錄名，前端資料路徑同步更新。
客戶端目錄只讀取、不寫入。

診斷用：

```powershell
dotnet run -- --client <dir> --probe 1005983,1472290,1113211        # 印出 info 全部子節點 + String 名稱
dotnet run -- --client <dir> --flags exceptUpgrade,Etuc,bossReward  # 各 info 欄位的分類件數與樣本
dotnet run -- --client <dir> --table islot,tuc,cash,exceptUpgrade   # 全部裝備的 TSV：id、category、名稱、各欄位原始值（缺省為空；有子節點時印 {子節點數}）
```

## 讀取方式

TMS v283 是 KMST1125 分割格式（`Data/<套件>/<套件>.wz` + `_000.wz…` + `.ini`）。以 `Data/Base/Base.wz` 進入，
`Wz_Structure.IsKMST1125WzFormat` 為 true，用 `LoadKMST1125DataWz` 載入整棵樹（`Character/<子資料夾>` 各自的套件會一併掛上）。
`Data/Packs/*.ms`（Mob/Skill）本工具不需要。

`Data/Character/` 根目錄套件（`Character.wz`/`Character_000.wz`）只含 `0000xxxx.img`/`0001xxxx.img`（身體/頭）、`CustomMerge.img`、
`JobWingAndTail.img`，**沒有裝備 img**。匯出程式仍會掃根目錄（有裝備時 category 為 `Character`），目前產出 0 件。

## 輸出

| 檔案 | 內容 |
|---|---|
| `meta.json` | `{ dataVersion: "TMS v283", exportedAt, client: "TMS", version: 283 }` |
| `index.json` | `IndexEntry[]`（`src/utils/mst/enhance/types.ts`），依 id 排序；含 `canonical` / `variantLabel`（見「同名變體」） |
| `equip/<category>.json` | `Record<id, EquipData>`，category = `Character/` 子資料夾名 |
| `sets.json` | `Record<setId, { name, completeCount }>`（`Etc/SetItemInfo.img` 的 `setItemName`/`completeCount`） |
| `slot-names.json` | `islot` 代碼 → 中文部位名（**人工對照表**，WZ 沒有在地化部位名；只輸出實際出現的代碼） |
| `potential-options.json` | `Item/ItemOption.img`：`{ id, grade, text, optionType?, reqLevel?, weight?, levels: { <潛能等級>: { <stat>: value } } }[]`；`grade = id / 10000`（原始值，語意由 Task 3 決定）；`text` 為 WZ 樣板（例：`STR +#incSTRr%`） |

匯出範圍：`Character/*/` 下 id 介於 1,000,000–1,999,999、且有 `info` 節點的 img（Face/Hair 等非裝備 id 自然排除）。
v283：WZ 32,090 件，排除測試/佔位道具 305 件後匯出 **31,785** 件、22 個 category（見下方「排除的測試/佔位道具」）。其中 2,402 件在 `String/Eqp.img` 沒有名稱（`name` 為空字串，多為現金/測試道具；非現金 2,243 件）：**保留在 `equip/<category>.json`，但不列入 `index.json`**（index 29,383 件）。

大小（v283，Task 1b 後）：`index.json` 5.00 MB，gzip **387,236 bytes**（< 1 MB，不需縮寫欄位）；`public/data/tms-v283` 總計 **20 MB**（`du -sh`；`equip/` 15 MB）。

## 欄位對照

「WZ」= 直接取 `info/<欄位>`；「推導」= WZ 無直接欄位，依規則推導；「KMS-estimate」= 依 KMS 規則推估。

| EquipData 欄位 | 來源 | 類型 |
|---|---|---|
| `id` | img 名稱 | WZ |
| `name` | `String/Eqp.img/Eqp/<分類>/<id>/name` | WZ |
| `category` | `Character/` 子資料夾名 | 推導 |
| `slot` | `islot` 原始代碼（缺省為 `""`） | WZ |
| `level` | `reqLevel`（缺省 0；334 件鍵名帶尾隨空白 `"reqLevel "`，精確鍵不存在時改讀它） | WZ |
| `jobs` | `reqJob` bitmask：0/缺省 → `'all'`；1 warrior、2 magician、4 bowman、8 thief、16 pirate；負值 → `'all'`（同樣有 `"reqJob "` 變體） | 推導 |
| `base` | 見下方屬性對照 | WZ |
| `tuc` | `tuc`（可上卷次數，缺省 0） | WZ |
| `cash` | `cash == 1` | WZ |
| `setId` | `setItemID`（缺省/0 → `null`） | WZ |
| `bossReward` | **`bossReward == 1`**（與 KMS 同名；v283 共 1,725 件） | WZ |
| `isWeapon` | `category === 'Weapon'` 且 id 前 3 碼 ≠ 135 | 推導 |
| `isMagicWeapon` | `isWeapon` 且 id 前 4 碼 ∈ {1212, 1252, **1254**, 1262, 1282, 1372, 1382, 1552} | 推導 |
| `canStarforce` | `(tuc > 0 || 阿斯特拉副手) && !cash`；阿斯特拉副手 = id 前 3 碼 172 且 `islot == "Si"`（114 件，見下方「172xxxx 阿斯特拉副手」）。WZ 沒有已確認的禁止星力旗標；匯出共 10,063 件（排除測試道具前 10,072 = 9,958 + 114） | 推導 |
| `canFlame` | 非現金，且 category ∈ {Weapon（非 135x）, Cap, Coat, Longcoat, Pants, Shoes, Glove, Cape}，或 Accessory 且 `islot` ∈ {Af 臉, Ay 眼, Ae 耳, Pe 墜飾, Be 腰帶, Po 口袋}；其餘（戒指、肩膀、勳章、徽章、心臟、圖騰、Shield、拼圖類…）false。WZ 沒有星火旗標。**逐 id 覆寫**（`FlameOverrides`）：1143471 不朽的遺產、1202287 古代石板複製品 → true（見下方「星火覆寫」）；匯出共 10,666 件 | KMS-estimate |
| `flameBoss` | 星火用 BOSS 規則（4 行、覺醒 +2 階）與否：= `bossReward`，只有 1202287 古代石板複製品覆寫為 false。計算模組的星火規則一律讀 `flameBoss`，`bossReward` 保留給其他用途 | 推導 |
| `canExceptional` | `exceptionalMax > 0` | 推導 |
| `exceptionalMax` | `Etuc`（卓越強化次數，缺省 0；v283 只有 6 件 > 0，見下） | WZ |
| `superior` | `superiorEqp == 1`（尊貴裝備，星力表不同；57 件） | WZ |
| `blockGoldHammer` | `blockGoldHammer == 1`（禁止黃金鐵鎚；16 件） | WZ |
| `tradeBlock` | `tradeBlock == 1` 或 `equipTradeBlock == 1`（匯出 11,039 件） | WZ |
| `timeLimited` | `timeLimited == 1`（WZ 也有值 0 的 625 件 → false；匯出 1,202 件） | WZ |
| `fixedPotential` | `fixedPotential == 1`（644 件） | WZ |
| `eventVariant` | `exceptTransmission == 1 || undecomposable == 1`（950 件） | WZ |
| `accountShare` | `accountSharable == 1 || sharableOnce == 1`（414 件） | WZ |

### 排除的測試/佔位道具（`ExcludeRule`，使用者決定）

依名稱判斷（含現金道具），符合者**完全不匯出**（不在 `equip/`、也不在 `index.json`）。依序比對，第一條符合者計數：

| 規則 | 件數 | 例 |
|---|---|---|
| 名稱含 `dummy`（不分大小寫） | 3 | 1302362 1702207_dummy、1302363、1690206 戰國時代武器dummy |
| 名稱是 1–3 個 ASCII 英文字母 | 8 | "aa"：1932565、1932566、1983517–1983519、1702135、1702199、1702200 |
| 名稱含 `GM` | 9 | 1003890、1007171、1051351、1052173、1052624、1072633、1072830、1102582、1702431 |
| 名稱含韓文（U+AC00–U+D7A3，未翻譯的 KMS 專屬內容） | 282 | 含韓文共 288 件，其中 6 件已由 GM 規則排除 |
| 明確 id：1932236 "2014 horse"（使用者確認的佔位坐騎） | 1 | — |
| STR/DEX/INT/LUK 全部 ≥ 999 的 GM 數值道具 | 2 | 1002140、1003142 維澤特帽 |
| 合計 | **305** | | fixture 無任何一件被排除 |

**保留**（名稱像測試但是真實道具）：測試用ESP限制器 1262001/1262018/1262022/1262060（凱內西斯初始武器）、烏勒斯的握力測試機、名譽開發者、
祕密團體臨時成員、英文名勳章（31 件）。`equip-data.spec.ts` 檢查以上兩份清單。

### 172xxxx 阿斯特拉副手（`canStarforce` 例外）

WZ 中 id 172xxxx 共 114 件，**全部**是阿斯特拉副手（Weapon 資料夾、`islot = Si`），每件都 `tuc = 0`、`cash = 0`、
`exceptUpgrade = 0`（明確寫 0）、`tucIgnoreForPotential = 1`、`onlyUpgrade` 15 項。照 `tuc > 0` 規則會被判成不可星力，
但 Nexon API fixture 有 5 件是 19–25★（1723902 阿斯特拉手環 24★、1720602 羽毛 25★、1721102 腕帶 24★、1720801 遺跡 19★、
1722902 萬能彈藥 24★），屬性/HP/攻擊全部符合非武器表。

找不到專屬的 WZ 旗標：`exceptUpgrade = 0` + `tuc = 0` 另外還命中 15 件阿斯特拉盾（1098012–1098014 靈魂盾、1099023–1099034
力量盾，fixture 無樣本、未驗證），`tucIgnoreForPotential` 還命中靈魂盾/力量盾/連發槍/戒指等。所以採**最窄的明確規則**：
id 前 3 碼 = 172 且 `islot = Si`（不含上述 15 件阿斯特拉盾，它們維持 `canStarforce = false`）。其他 `tuc = 0` 裝備不受影響
（`equip-data.spec.ts` 逐件檢查 `canStarforce === (tuc > 0 || 阿斯特拉副手) && !cash`）。
星力 DEF 只加到 15★ 的規則在 `rules/starforce.ts`（`statTable.defMaxStar`，見 `rules/sources.md` STARFORCE）。

### 星火覆寫（`FlameOverrides`）

| id | 名稱 | WZ | 覆寫 | 依據 |
|---|---|---|---|---|
| 1143471 | 不朽的遺產（勳章，islot Me） | `bossReward = 1`、`Etuc = 3` | `canFlame = true`（`flameBoss` 照 bossReward = true） | research/flame.md：勳章不可附加星火，例外 Immortal Legacy；fixture 6/6 筆星火可用 BOSS 規則解出 |
| 1202287 | 古代石板複製品（Totem 資料夾，islot Po） | `bossReward = 1` | `canFlame = true`、`flameBoss = false` | research/flame.md：圖騰不可附加星火，例外 Ancient Tablet Replica；fixture 8/8 筆星火只在**非 BOSS** 規則下可解（BOSS 規則固定 4 行，有些解不出） |

### 同名變體（`index.json` 的 `canonical` / `variantLabel`）

以 index.json（有名稱的裝備）的 `(slot, name, cash)` 分組（controller 裁定：現金與非現金不互相競爭 canonical，例：非現金 紅鷹鋼盔 1000054 與現金 1000009 各自是 canonical；標籤也只和同 cash 組的 canonical 比較）。空殼道具（非現金、Lv0、tuc 0、無基礎屬性）**暫不排除**（待使用者決定；會連帶排除 fixture 1122334、1143384、1122215），照一般道具處理：
- **canonical**：每組恰好 1 件。取 `eventVariant` / `timeLimited` / `fixedPotential` 成立數最少者（通常是 0 個），同分取最小 id。
  不用 `exceptUpgrade`（命運武器也帶這個旗標）。不重複的裝備一律 canonical。
- **variantLabel**：canonical 為 `''`；其他依序串接（以「・」連接）：活動版（`eventVariant`）、期限（`timeLimited`）、固定潛能（`fixedPotential`）；
  三者皆無、且該件 WZ `info/tradeBlock == 1` 而 canonical 沒有 → 綁定版。
  綁定版只看 `info/tradeBlock`（不可交易），**不看** `equipTradeBlock`（裝備後不可交易）：例如 canonical 1003797 高貴的戰士頭盔帶
  `equipTradeBlock = 1`，1005302 帶 `tradeBlock = 1`，若用匯出的 `tradeBlock`（兩者 OR）就分不出綁定版。
- 例（高貴的戰士頭盔）：1003797 canonical `''`；1005302 `綁定版`；1005567 `活動版`；1005196 `活動版・期限`；1006425 `活動版・期限・固定潛能`。
- **後備標籤**（controller 裁定）：上述規則仍為空時，依與 canonical 第一個不同的欄位：`tuc` →「可上卷N次」（N = 自己的 tuc）、`level` →「Lv.N」、`base` →「數值不同」、其他任何 EquipData 欄位（category、jobs、setId、cash、旗標…）→「#<id>」；除 id 外全部相同 → `''`（UI 合併）。
  例：1000068 神鳴的帽子 `可上卷8次`（vs 1000064）、1002509 真‧楓葉頭盔 `Lv.8`、1002872 麋鹿角 `數值不同`、1012309 血腥面具 `#1012309`、1001059 戰士覺醒套裝帽子 `''`。

件數（v283）：index 29,383 件、25,255 組（2,578 組有重複，共 6,706 件）。canonical **25,255**；有標籤 **3,103**：
- 旗標標籤 2,010：綁定版 1,083、期限 328、活動版・固定潛能 215、活動版 202、活動版・期限・固定潛能 120、固定潛能 41、活動版・期限 15、期限・固定潛能 6。
- 後備標籤 1,093：可上卷N次 118、Lv.N 224、數值不同 322、#<id> 429。
- 非 canonical 且標籤為空 **1,025**（除 id 外與 canonical 完全相同）。
- 另有 266 組沒有「乾淨」版本，canonical 本身就是活動/期限/固定潛能版。

屬性對照（`info` 鍵 → `Stats` 鍵，值 0 省略）：`incSTR→str`、`incDEX→dex`、`incINT→int`、`incLUK→luk`、`incMHP→maxHp`、
`incMMP→maxMp`、`incPAD→att`、`incMAD→matt`、`incPDD→def`、`incSpeed→speed`、`incJump→jump`、`bdR→bossDamage`、`imdR→ignoreDef`、
`damR→damagePct`、`incMHPr→maxHpPct`、`incMMPr→maxMpPct`。不匯出：`incACC`、`incEVA`、`incMDD`（現行版本已無用）、`incCraft` 等。
`allStatPct`、`levelReduce` 不會出現在裝備基礎屬性。

### Spike 觀察到的相關 WZ 欄位（v283，件數為帶該鍵的裝備數）

| 欄位 | 件數 | 觀察 / 用途 |
|---|---|---|
| `bossReward` | 1,725 | BOSS 掉落旗標（例：永恆盜賊頭巾、命運鬥拳） |
| `exceptUpgrade` | 851 | 出現在創世/命運武器、見習道士、挑戰者、支配者墜飾、頂級培羅德烙印腰帶等。**意義未確認，未使用**（命運鬥拳帶此旗標但實際資料為 22★，故不能當禁止星力旗標） |
| `onlyUpgrade` | 202 | 只能用指定卷軸（子節點是卷軸 id 清單；例：命運武器 2590/2591、瑪瑙戒指） |
| `Etuc` | 6 | 卓越強化次數：1012632 口紅控制器標誌 1、1012911 傲慢的原罪 3、1022278 附有魔力的眼罩 1、1032316 指揮官力量耳環 1、1132308 夢幻的腰帶 1、1143471 不朽的遺產 3 |
| `exUpgradeBlock` | 49 | 封印的創世武器、精靈墜飾（意義未確認，未使用） |
| `exUpgradeChangeBlock` | 104 | 挑戰者/菇菇系列（意義未確認，未使用） |
| `blockGoldHammer` | 16 | 禁止黃金鐵鎚：闇黑龍王項鍊系、八福/瑪瑙/復仇/宇宙/覺醒戒指、挑戰者圖騰。匯出為 `blockGoldHammer` |
| `exceptToadsHammer` | 901 | 不可用蟾蜍鐵鎚（轉移），與本工具無關 |
| `superiorEqp` | 57 | 尊貴（Superior，如赫力席母/超新星/塔蘭特）裝備，星力表不同。匯出為 `superior` |
| `tucIgnoreForPotential` | 192 | 潛能不受 tuc 限制（副手類），未使用（172xxxx 阿斯特拉副手全帶，但也出現在其他副手/戒指，不能當星力旗標） |
| `noPotential` / `fixedPotential` | 36 / 644 | 潛能限制；`fixedPotential` 匯出為 `fixedPotential`（變體標籤用），`noPotential` 未使用 |
| `timeLimited` / `exceptTransmission` / `undecomposable` / `accountSharable` / `sharableOnce` | 1,828（值 1：1,203） / 700 / 619 / 436（值 1：412） / 112 | 變體旗標：`timeLimited`、`eventVariant`、`accountShare`（見欄位對照） |
| `exGrade` | 384 | 值 1–4（活動/特殊裝備），意義未確認，未使用 |
| `reqJob2` / `reqSpecJob` | 375 / 764 | 細分職業限制（例：徽章 reqSpecJob），未使用 |
| `cubeExBaseOptionLevel` | 86 | 楓葉系裝備，未使用 |

星火：WZ 中找不到任何可否上星火的旗標，`canFlame` 全部為 KMS-estimate。

`reqJob` 出現值（精確鍵）：缺省 2,573（含只有 `"reqJob "` 變體的件）、0 20,749、1 2,827、2 1,691、3 7、4 1,315、5 1、8 1,554、9 27、13 17、16 1,183、24 143、**-1 3 件**
（1422011、1442018、1442023 → `'all'`）。

### 魔法武器交叉檢查（`isMagicWeapon` vs `incMAD > incPAD`，僅檢查 PAD/MAD 至少一個 > 0 的武器）

- 計畫原清單沒有 **1254**（TMS「陰陽扇」，78 件、全部 magician 限定、76/78 件 incMAD > incPAD，含創世/命運陰陽扇）；
  未加入時 78 件全數不一致，因此加入。1552（「扇子」，104 件，同樣 magician 限定）存在，依計畫加入。
- 加入後仍不一致 46 件，皆為特殊/測試/現金道具，維持前綴規則：
  - 魔法前綴但 MAD ≤ PAD：1212097 封印露塔必思魔法克魯 (90/90)、1252125 柔弱樹枝 (15/15)、1282021 純手工護腕 (PAD 15/MAD 0)、1382144 (無名, 1/0)、1382261 牧童枴杖 (100/0)
  - 非魔法前綴但 MAD > PAD：1292037 獅子精神<仙扇>（虎影仙扇，物理職業）、1302027 綠色雨傘、1332053 野外燒烤串、
    1690000–1690014 / 1690200–1690207 / 1690329 / 1690332（「xx等武器道具」等 dummy，PAD 15/MAD 23，共 24 件）、
    1702493 黑暗之槌、1703408 強化咖波雨傘、1722300–1722302 / 1723800–1723802 / 1724000–1724002 / 1724400–1724402（阿斯特拉系列，PAD 0/MAD 7，共 12 件）
