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
| `index.json` | `IndexEntry[]`（`src/utils/mst/enhance/types.ts`），依 id 排序 |
| `equip/<category>.json` | `Record<id, EquipData>`，category = `Character/` 子資料夾名 |
| `sets.json` | `Record<setId, { name, completeCount }>`（`Etc/SetItemInfo.img` 的 `setItemName`/`completeCount`） |
| `slot-names.json` | `islot` 代碼 → 中文部位名（**人工對照表**，WZ 沒有在地化部位名；只輸出實際出現的代碼） |
| `potential-options.json` | `Item/ItemOption.img`：`{ id, grade, text, optionType?, reqLevel?, weight?, levels: { <潛能等級>: { <stat>: value } } }[]`；`grade = id / 10000`（原始值，語意由 Task 3 決定）；`text` 為 WZ 樣板（例：`STR +#incSTRr%`） |

匯出範圍：`Character/*/` 下 id 介於 1,000,000–1,999,999、且有 `info` 節點的 img（Face/Hair 等非裝備 id 自然排除）。
v283：32,090 件、22 個 category。其中 2,402 件在 `String/Eqp.img` 沒有名稱（`name` 為空字串，多為現金/測試道具；非現金 2,243 件）：**保留在 `equip/<category>.json`，但不列入 `index.json`**（index 29,688 件）。

大小（v283）：`index.json` 3.97 MB，gzip **368,392 bytes**（< 1 MB，不需縮寫欄位）；`public/data/tms-v283` 總計 **16 MB**（`du -sh`；`equip/` 12 MB）。

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
| `canStarforce` | `tuc > 0 && !cash`（WZ 沒有已確認的禁止星力旗標；v283 共 9,958 件） | 推導 |
| `canFlame` | 非現金，且 category ∈ {Weapon（非 135x）, Cap, Coat, Longcoat, Pants, Shoes, Glove, Cape}，或 Accessory 且 `islot` ∈ {Af 臉, Ay 眼, Ae 耳, Pe 墜飾, Be 腰帶, Po 口袋}；其餘（戒指、肩膀、勳章、徽章、心臟、圖騰、Shield、拼圖類…）false。WZ 沒有星火旗標 | KMS-estimate |
| `canExceptional` | `exceptionalMax > 0` | 推導 |
| `exceptionalMax` | `Etuc`（卓越強化次數，缺省 0；v283 只有 6 件 > 0，見下） | WZ |
| `superior` | `superiorEqp == 1`（尊貴裝備，星力表不同；57 件） | WZ |
| `blockGoldHammer` | `blockGoldHammer == 1`（禁止黃金鐵鎚；16 件） | WZ |
| `tradeBlock` | `tradeBlock == 1` 或 `equipTradeBlock == 1` | WZ |

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
| `tucIgnoreForPotential` | 192 | 潛能不受 tuc 限制（副手類），未使用 |
| `noPotential` / `fixedPotential` | 36 / 644 | 潛能限制，未使用 |
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
