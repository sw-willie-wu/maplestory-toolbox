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
dotnet run -- --client <dir> --node "Item\ThothSearchOption.img"   # 印出任意 WZ 節點（路徑以 \ 或 / 分隔，途中的 .img 自動解開；子節點 ≥ 40 的節點不展開）
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
| `index.json` | `IndexEntry[]`（`src/utils/mst/enhance/types.ts`），依 id 排序；含 `enhanceable`（見下）與 `canonical` / `variantLabel`（見「同名變體」） |
| `equip/<category>.json` | `Record<id, EquipData>`，category = `Character/` 子資料夾名 |
| `sets.json` | `Record<setId, SetInfo>`：`{ name, completeCount, effects, jokerPossible, zeroWeaponJokerPossible }`（`Etc/SetItemInfo.img`；`effects` 見下方「套裝效果」） |
| `categories.json` | `SearchCategory[]`：官方道具分類（`Item/ThothSearchOption.img`，見下方「官方道具分類」） |
| `jobs.json` | `JobsData`：`groups`（reqJob 位元 → 職業群名稱）與 `specJobs`（資料中出現的每個特殊職業 id，見下方「特殊職業限制」） |
| `slot-names.json` | `islot` 代碼 → 中文部位名（**人工對照表**，WZ 沒有在地化部位名；只輸出實際出現的代碼） |
| `potential-options.json` | `Item/ItemOption.img`：`{ id, grade, text, optionType?, reqLevel?, weight?, levels: { <潛能等級>: { <stat>: value } } }[]`；`grade = id / 10000`（原始值，語意由 Task 3 決定）；`text` 為 WZ 樣板（例：`STR +#incSTRr%`） |

匯出範圍：`Character/*/` 下 id 介於 1,000,000–1,999,999、且有 `info` 節點的 img（Face/Hair 等非裝備 id 自然排除）。
**現金道具（`cash == 1`）照常匯出**（使用者決定，UI 重新設計 §8.2：未來 Navbar 全站搜尋要搜得到全部裝備，含點裝；撤銷 Task 1c 的排除）。
點裝和一般裝備放在同一個 `equip/<category>.json`（`PetEquip` 全為點裝 → `equip/PetEquip.json`）。強化計算機只顯示 `!cash && enhanceable`，過濾在 `useEquipData` 層，不在匯出。
v283：WZ 32,090 件，排除測試/佔位道具 **377** 件（含 1690xxx 72 件，見「排除的測試/佔位道具」）後匯出 **31,713** 件、22 個 category；
其中點裝 **15,032** 件、非點裝 **16,681** 件。2,402 件在 `String/Eqp.img` 沒有名稱（`name` 為空字串）：**保留在 `equip/<category>.json`，但不列入 `index.json`**
（index **29,311** 件：點裝 14,873、非點裝 14,438）。非現金空殼道具（Lv0、tuc 0、無基礎屬性）**保留**（使用者決定：預設保留）。

**`enhanceable`**（只在 `IndexEntry`）＝ `!cash && (canStarforce || tuc > 0 || canFlame || canExceptional)`，依該件 EquipData 計算。
只能洗潛能的裝備也算不可強化（使用者決定）。v283：index 中 **10,910** 件 enhanceable（含無名稱者在內的全部匯出非點裝：11,072 件）。
原本用分類排除的 6 類（Bits、TamingMob、SkillSkin、ArcaneForce、AuthenticForce、Jewel）中 enhanceable 的筆數 = **0**（匯出程式印出、`equip-data.spec.ts` 檢查），所以工具不需另做分類排除。

大小（v283，UI 重新設計 Task 1 後）：`index.json` 7.47 MB，gzip **409,874 bytes**（門檻 1.5 MB，`equip-data.spec.ts` 檢查；超過時才拆工具專用 index）；
`public/data/tms-v283` 總計 **24 MB**（`du -sh`；`equip/` 17 MB）。

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
| `cash` | `cash == 1`（匯出 15,032 件） | WZ |
| `setId` | `setItemID`（缺省/0 → `null`） | WZ |
| `bossReward` | **`bossReward == 1`**（與 KMS 同名；v283 共 1,725 件） | WZ |
| `isWeapon` | `category === 'Weapon'` 且 id 前 3 碼 ≠ 135 | 推導 |
| `isMagicWeapon` | `isWeapon` 且 id 前 4 碼 ∈ {1212, 1252, **1254**, 1262, 1282, 1372, 1382, 1552} | 推導 |
| `canStarforce` | `(tuc > 0 || 阿斯特拉副手) && !cash`；阿斯特拉副手 = id 前 3 碼 172 且 `islot == "Si"`（114 件，見下方「172xxxx 阿斯特拉副手」）。WZ 沒有已確認的禁止星力旗標；匯出共 10,063 件（排除測試道具前 10,072 = 9,958 + 114） | 推導 |
| `canFlame` | 非現金，且 category ∈ {Weapon（非 135x）, Cap, Coat, Longcoat, Pants, Shoes, Glove, Cape}，或 Accessory 且 `islot` ∈ {Af 臉, Ay 眼, Ae 耳, Pe 墜飾, Be 腰帶, Po 口袋}；其餘（戒指、肩膀、勳章、徽章、心臟、圖騰、Shield、拼圖類…）false。WZ 沒有星火旗標。**逐 id 覆寫**（`FlameOverrides`）：1143471 不朽的遺產、1202287 古代石板複製品 → true（見下方「星火覆寫」）；匯出共 10,594 件（1690xxx 排除前 10,666） | KMS-estimate |
| `flameBoss` | 星火用 BOSS 規則（4 行、覺醒 +2 階）與否：= `bossReward`，只有 1202287 古代石板複製品覆寫為 false。計算模組的星火規則一律讀 `flameBoss`，`bossReward` 保留給其他用途 | 推導 |
| `canExceptional` | `exceptionalMax > 0` | 推導 |
| `exceptionalMax` | `Etuc`（卓越強化次數，缺省 0；v283 只有 6 件 > 0，見下） | WZ |
| `superior` | `superiorEqp == 1`（尊貴裝備，星力表不同；57 件） | WZ |
| `blockGoldHammer` | `blockGoldHammer == 1`（禁止黃金鐵鎚；16 件） | WZ |
| `tradeBlock` | `tradeBlock == 1` 或 `equipTradeBlock == 1`（匯出 11,039 件，非點裝 10,988） | WZ |
| `timeLimited` | `timeLimited == 1`（WZ 也有值 0 的 625 件 → false；匯出 1,202 件，非點裝 1,180） | WZ |
| `fixedPotential` | `fixedPotential == 1`（644 件） | WZ |
| `eventVariant` | `exceptTransmission == 1 || undecomposable == 1`（950 件） | WZ |
| `accountShare` | `accountSharable == 1 || sharableOnce == 1`（414 件） | WZ |
| `searchCategory` / `searchDetail` | 官方道具分類 id（見「官方道具分類」）；`IndexEntry` 同值 | WZ / 推導 |
| `specJob` | `reqSpecJob`，沒有時 `reqJob2`（含尾隨空白鍵變體；v283 沒有同時帶兩者的道具）；都沒有 → `null`。`IndexEntry` 同值 | WZ |

### 官方道具分類（`categories.json`、`searchCategory` / `searchDetail`）

來源 `Item/ThothSearchOption.img`（遊戲內道具搜尋篩選）。結構（v283）：
- `ItemCategory/<key>/string`：6 個大分類 Armor 防具、Accessory 飾品、OneHandSword 單手武器、TwoHandSword 雙手武器、SubWeapon 副手武器、Etc 其他。
- `ItemDetailCategory/<key>/<detail>/{string, begin, end}`：各大分類的細項與 id 範圍（含端點）。**鍵名不一致**：ItemCategory 的 `OneHandSword` / `TwoHandSword` 對應 ItemDetailCategory 的 `OneHandWeapon` / `TwoHandWeapon`，依位置配對（其餘同名）。
- 每個大分類都有 `default`（所有，begin = end = 0）：UI 用，不匯出。`SubWeapon/CannonGunPowder` 另有 `begin2/end2`（1352980），收進 `ranges`。
- 同層還有 `Option`（搜尋用屬性）與 `DefaultSetting`（各職業預設篩選），未使用。

`categories.json` = `[{ id: ItemCategory 鍵, name, details: [{ id: 細項鍵, name, begin, end, ranges: [[begin, end], ...] }] }]`；細項 id 只在同一大分類內唯一（例：OneHandSword/Sword 單手劍、TwoHandSword/Sword 雙手劍）。

每件裝備依序：
1. **range**：id 落在某細項範圍 → `searchCategory` = 大分類 id、`searchDetail` = 細項 id。範圍重疊時取最窄者，同寬取 WZ 順序在前者。
   v283 的 `SubWeapon/AranPendulum`（狂狼玉墜）與 `CaptainSight`（瞄準器）都寫 1352910–1352919（WZ 資料錯誤；這段實際是「鷹眼」瞄準器）→ 取 CaptainSight；真正的狂狼錘 1352930–1352939 不在任何範圍（走 prefix-fallback → SubWeapon）。
   `SubWeapon/Bracelet` 1354000–1354099 包含 WeaponBelt / Norigae / HexSeeker 的較窄範圍 → 取較窄者。
2. **prefix-fallback**：沒有範圍、且在 `Character/Weapon` 資料夾 → 依 id 前綴 p = id / 10000（與 ThothSearchOption 本身依前綴分單/雙手一致；**不用 islot**：許多雙手武器的 islot 是 Wp，例如 1542 刀、1552 扇、1403 拳套）：121–139（135 除外）→ OneHandSword、140–159 → TwoHandSword（含 1502/1512/1562/1572）、135 / 172 → SubWeapon；`searchDetail = null`。ThothSearchOption 沒收錄許多新武器類型。
3. **islot-fallback**：Weapon 資料夾中不符合上述前綴者（v283：點裝武器外觀 1701–1704 等 1,661 件，非點裝只有 1702176 鬼焰刀*30天；1690xxx 佔位道具已排除）→ 依 `islot`：Wp → OneHandSword、WpSi → TwoHandSword、Si → SubWeapon、Cp → Armor，`searchDetail = null`。
   其他 islot 的 Weapon 資料夾點裝（1602000–1602007 技能效果 islot Ri、5 件 1702xxx islot MaPn，共 13 件）→ 兩者皆 `null`（`isWeapon` 仍為 true；測試只要求非點裝武器有分類）。
4. **emblem-fallback**（推導）：`Character/Accessory` 資料夾、`islot = Si`、id 1190000–1191999 且沒有範圍 → `Accessory` / `Emblem`。WZ 的 Emblem 範圍只到 1190199（PowerSource 1190200–1190299），之後的徽章（1190300+、1191xxx）沒有範圍。只限 Accessory 資料夾。
5. 其他 → 兩者皆 `null`。

`LoadSearchCategories` 檢查每個 ItemDetailCategory 恰好配對一次（重複或未配對 → 匯出失敗）。

件數（v283，匯出的 31,713 件，含點裝）：range **26,000**、prefix-fallback **770**、islot-fallback **1,662**、emblem-fallback **102**、none **3,179**。
大分類件數（匯出全部 / 匯出非點裝 / index.json）：Armor 14,485 / 3,895 / 14,324、Accessory 5,141 / 3,273 / 5,121、OneHandSword 4,221 / 2,629 / 4,170、
TwoHandSword 2,939 / 2,865 / 2,895、SubWeapon 569 / 569 / 569、Etc 1,179 / 368 / 1,174、無 3,179 / 3,082 / 1,058。
沒有範圍者（category:id/1000）：
- Weapon（prefix / islot fallback）：1215=40、1252=97、1254=77、1352=92、1353=32、1354=13、1390=5、1392=2、1403=43、1502=11、1512=11、1542=103、1552=104、1562=13、1572=13、1720–1725 阿斯特拉=114；
  點裝（islot fallback，或 islot Ri/MaPn 時無分類）：1602=8、1701=1、1702=838（含非點裝 1702176）、1703=825、1704=3。
- Accessory（emblem fallback）：1190=90、1191=12。
- 無分類：TamingMob 2,219（1902/1912/1930/1932/1933/1939/1983/1984/1992，含點裝）、Bits 715、Totem 203、ArcaneForce 7、AuthenticForce 8、SkillSkin 7、Jewel 1、PetEquip 1812=6。
- 非點裝的 `isWeapon` 裝備全部有 `searchCategory`（`equip-data.spec.ts` 檢查）。

### 特殊職業限制（`specJob`、`jobs.json`）

`specJob` = `reqSpecJob`，沒有時 `reqJob2`。v283 匯出資料共 **1,138** 件有值，分布：
21=2、22=2、23=2、24=2、25=17、27=2、31=23、36=143、37=63、41=149、42=226、51=12、61=3、63=55、64=11、65=3、99=3、101=50、142=65、151=12、152=58、154=51、155=11、161=50、162=12、164=12、172=89、175=10。

`jobs.json`：
- `groups`：`{ id, bit, name, confirmed }`，劍士/法師/弓箭手/盜賊/海盜（以 `String/Skill.img` 100/200/300/400/500 的 `bookName`「X入門」確認，全部 confirmed）。
- `specJobs`：資料中出現的每個 specJob `{ id, name, nameEn, confirmed, legacyName, count }`。名稱以使用者舊 notebook（v249/v261 時代）的對照表為起點，**只有 v283 `String/Skill.img` 職業代碼 id·100 … id·100+99 的 `bookName` 含該名稱時才採用**（例：142 ↔ 14200「凱內西斯 - 1轉」）；舊表沒有的 id 若各技能書名一致則採用書名；其他 `name = null`（`legacyName` 只留作參考，不當作名稱）。`nameEn` 只來自舊表（WZ 無英文職業名），舊表的 `Xemon` 修正為 `Xenon`。
- 無法確認：**22**（舊表 龍魔導士；22xx 書名是「精通N次」，2 件）、**99**（舊表 陰陽師；沒有 99xx 技能書，3 件：1254072 濃姬的陰陽扇、1552084 / 1552133 妖蝶姬之花扇）→ `name = null`。
- 舊表沒有：**161**（50 件，1215xxx 長劍、光劍手徽章）→ 書名一致「蓮」，`name = '蓮'`、`nameEn = null`。

### 套裝效果（`sets.json` 的 `effects`，僅顯示用）

`Etc/SetItemInfo.img/<setId>/Effect/<件數>` → `effects[<件數>]` = `SetEffect`：
- `stats`：純量鍵原樣（WZ 鍵名，如 `incSTR`、`incPAD`、`incAllStat`、`incMHPr`、`nbdR`、`incACC`…；不換成 StatKey）。
- `options`：`Option/<k>/{option, level}` → `[{ id, level }]`（潛能選項 id，可對 `potential-options.json`）；v283 有 27 個 tier 帶 2 個以上。
- `activeSkills`：`activeSkill/<k>/{id, level}` → `[{ id, level }]`。
- `other`：其他巢狀節點原樣（`OptionToMob`、`bonusByTime`）。

套裝層另有 `jokerPossible` / `zeroWeaponJokerPossible`（`== 1`）。不匯出：`ItemID`、`parts`、`Desc`、`effectLink`（視覺特效連結）。v283 共 878 套，全部有 `effects`。

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
| id 1690000–1690999（「xx等武器/防具道具」佔位道具，使用者決定；UI 重新設計 §8.1） | 72 | WZ 共 73 件，1690206 戰國時代武器dummy 已由 dummy 規則排除；放在最後以免改變前面規則的件數 |
| 合計 | **377** | | fixture 無任何一件被排除（`equip-data.spec.ts` 列出被排除的 fixture：0 件） |

**保留**（名稱像測試但是真實道具）：測試用ESP限制器 1262001/1262018/1262022/1262060（凱內西斯初始武器）、烏勒斯的握力測試機、名譽開發者、
祕密團體臨時成員、英文名勳章（31 件）。`equip-data.spec.ts` 檢查以上兩份清單。

**Hangul 相容字母（U+3131–U+318E）不算韓文規則**：韓文規則只看完整音節 U+AC00–U+D7A3。v283 有 **14** 件名稱用相容字母畫表情的點裝**保留**
（匯出程式會列出）：1005886 ㅁ 帽子、1005887 ㅇ 帽子、1005888 ㅍ 帽子、1012427–1012431 ㅎㅂㅎ/ㅎㅅㅎ/ㅎㅇㅎ/ㅎㅈㅎ/ㅎㅗㅎ 臉部裝飾、
1012592–1012597 ㅇㅂㅇ/ㅇ_ㅇ/ㅇㅅㅇ/ㅅㅂㅅ/ㅅ_ㅅ/ㅅ ㅅ 臉型裝飾。

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

以 index.json（有名稱的裝備）的 `(slot, name, cash)` 分組（controller 裁定；點裝與非點裝永不同組，例：非點裝紅鷹鋼盔 1000054 與點裝 1000009 各自是 canonical）。空殼道具（非現金、Lv0、tuc 0、無基礎屬性）**保留**（使用者決定；fixture 1122334、1143384、1122215 屬此類），照一般道具處理：
- **canonical**：每組恰好 1 件。**先取 `enhanceable`**（UI 重新設計 §8.2：避免不可強化的主版本把可強化的變體藏起來；組內唯一可強化的是活動／期限版時，它就是 canonical），
  再取 `eventVariant` / `timeLimited` / `fixedPotential` 成立數最少者（通常是 0 個），同分取最小 id。
  v283 只改變 1 組：凱撒戒指（Ri）1112751（tuc 0、不可強化）→ 1112779（tuc 2）成為 canonical，1112751 變成 `可上卷0次`。點裝組全部不可強化，不受影響。
  不用 `exceptUpgrade`（命運武器也帶這個旗標）。不重複的裝備一律 canonical。
- **variantLabel**：canonical 為 `''`；其他依序串接（以「・」連接）：活動版（`eventVariant`）、期限（`timeLimited`）、固定潛能（`fixedPotential`）；
  三者皆無、且該件 WZ `info/tradeBlock == 1` 而 canonical 沒有 → 綁定版。
  綁定版只看 `info/tradeBlock`（不可交易），**不看** `equipTradeBlock`（裝備後不可交易）：例如 canonical 1003797 高貴的戰士頭盔帶
  `equipTradeBlock = 1`，1005302 帶 `tradeBlock = 1`，若用匯出的 `tradeBlock`（兩者 OR）就分不出綁定版。
- 例（高貴的戰士頭盔）：1003797 canonical `''`；1005302 `綁定版`；1005567 `活動版`；1005196 `活動版・期限`；1006425 `活動版・期限・固定潛能`。
- **後備標籤**（controller 裁定）：上述規則仍為空時，依與 canonical 第一個不同的欄位：`tuc` →「可上卷N次」（N = 自己的 tuc）、`level` →「Lv.N」、`base` →「數值不同」、其他任何 EquipData 欄位（category、jobs、setId、cash、旗標…）→「#<id>」；除 id 外全部相同 → `''`（UI 合併）。
  例：1000068 神鳴的帽子 `可上卷8次`（vs 1000064）、1002509 真‧楓葉頭盔 `Lv.8`、1002872 麋鹿角 `數值不同`、1012309 血腥面具 `#1012309`、1001059 戰士覺醒套裝帽子 `''`。
- **完全相同變體收合**（UI 重新設計 §8.3）：組內依 id 由小到大，非 canonical 條目若與**組內 id 較小、已保留標籤且標籤種類相同**的非 canonical 條目
  除 id 外 EquipData 完全相同 → `''`（UI 收合）；每組相同內容只留 id 最小的一筆有標籤代表。標籤種類：同一個旗標標籤（`活動版`、`綁定版`…），或任一後備標籤
  （`#<id>` 每筆不同，所以以「後備」整類比對）。`活動版` / `期限` / `固定潛能` 條目若與 canonical 除 id 外 EquipData 完全相同 → `''`（這些旗標是 EquipData 欄位，canonical 帶著同樣的旗標，
  標籤會誤導；controller 裁定。例：1082708 武公的手套 原「期限・固定潛能」vs canonical 1082393）。只有 `綁定版` 與 canonical 相同時**保留**：
  1005302 `綁定版` 的 EquipData 與 canonical 1003797 完全相同（差別在 `info/tradeBlock`，不是 EquipData 欄位）。
  例（麋鹿的紅鼻子）：1012018/1012019/1012020 三件除 id 外相同的期限版 → 1012018 `期限`、1012019 與 1012020 `''`。

件數（v283，UI 重新設計 Task 1 後，含點裝）：index 29,311 件、25,183 組（2,578 組有重複，共 6,706 件）。canonical **25,183**；有標籤 **2,938**：
- 旗標標籤 1,841：綁定版 1,001、期限 295、活動版・固定潛能 202、活動版 191、活動版・期限・固定潛能 120、固定潛能 16、活動版・期限 15、期限・固定潛能 1。
- 後備標籤 1,097：可上卷N次 117、Lv.N 218、數值不同 321、#<id> 441。
- 非 canonical 且標籤為空 **1,190**：除 id 外與 canonical 完全相同 1,032（後備路徑 992、非綁定版旗標 40）；完全相同變體收合 **158 筆、139 組**（旗標 129、後備 29）。
  與 Task 1c 的非點裝資料相比，181 筆原有標籤變成 `''`（綁定版 82、期限 33、固定潛能 25、活動版・固定潛能 13、活動版 11、Lv.N 6、期限・固定潛能 5、#<id> 5、可上卷N次 1）。
- 另有 266 組（有重複者）沒有「乾淨」版本，canonical 本身就是活動/期限/固定潛能版。

**名稱尾端空白會分成不同組**：分組用 `String/Eqp.img` 的原始名稱，不 trim。v283 index 有 **260** 件名稱帶尾端空白（`\r\n` 143、半形空白 61、
多個半形空白 20、`\n` 18、全形空白 15、其他 3；非點裝 70 件），其中 **15** 組（非點裝 8 組）與不帶空白的同名組只差尾端空白而分開，
例：楓葉手套 1082252/1082439（`"楓葉手套 "`）與 1082440/1082441、阿貝羅 1532011（`"阿貝羅 "`）與 1532084 各自有 canonical。
目前維持原樣（匯出程式會印出件數）；UI 若要合併需在顯示/搜尋層 trim。

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
| `reqJob2` / `reqSpecJob` | 375 / 764 | 細分職業限制，匯出為 `specJob`（見「特殊職業限制」） |
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
    1690000–1690014 / 1690200–1690207 / 1690329 / 1690332（「xx等武器道具」等 dummy，PAD 15/MAD 23，共 24 件；交叉檢查在排除規則之前執行，這些已不匯出）、
    1702493 黑暗之槌、1703408 強化咖波雨傘、1722300–1722302 / 1723800–1723802 / 1724000–1724002 / 1724400–1724402（阿斯特拉系列，PAD 0/MAD 7，共 12 件）
