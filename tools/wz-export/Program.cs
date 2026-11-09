// WZ exporter for the equipment-enhancement calculator.
// Usage (see README.md):
//   dotnet run -- --client "<MapleStory dir>" --probe 1005983,1472290      print info nodes of items
//   dotnet run -- --client "<MapleStory dir>" --flags exceptUpgrade,Etuc    sample items carrying info keys
//   dotnet run -- --client "<MapleStory dir>" --table islot,tuc,cash         TSV of info keys for every equip
//   dotnet run -- --client "<MapleStory dir>" --out ../../public/data/tms-v283
using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using WzComparerR2.WzLib;

var opts = ParseArgs(args);
var client = opts.GetValueOrDefault("client") ?? throw new ArgumentException("--client <MapleStory dir> is required");
const int ClientVersion = 283;

var basePath = Path.Combine(client, "Data", "Base", "Base.wz");
if (!File.Exists(basePath)) throw new FileNotFoundException("Base.wz not found", basePath);
var wz = new Wz_Structure();
// TMS v283 uses the KMST1125 split layout (Data/<Pkg>/<Pkg>.wz + _000.wz ...).
if (wz.IsKMST1125WzFormat(basePath)) wz.LoadKMST1125DataWz(basePath); else wz.Load(basePath, true);
var root = wz.WzNode;
var character = root.FindNodeByPath("Character") ?? throw new InvalidOperationException("Character node missing");

if (opts.TryGetValue("probe", out var probe))
{
    var names = LoadEquipNames(root);
    foreach (var id in probe.Split(',').Select(int.Parse))
    {
        var hit = EnumerateEquipImgs(character).FirstOrDefault(e => e.Id == id);
        if (hit.Img == null) { Console.WriteLine($"{id}: NOT FOUND"); continue; }
        Console.WriteLine($"== {id} {names.GetValueOrDefault(id)} at {hit.Img.FullPath}");
        WithInfo(hit.Img, info => { foreach (var n in info.Nodes) Dump(n, "  "); });
    }
    return;
}

if (opts.TryGetValue("flags", out var flagList))
{
    var names = LoadEquipNames(root);
    var keys = flagList.Split(',');
    var samples = keys.ToDictionary(k => k, _ => new List<string>());
    var counts = keys.ToDictionary(k => k, _ => new Dictionary<string, int>());
    foreach (var (cat, id, img) in EnumerateEquipImgs(character))
    {
        WithInfo(img, info =>
        {
            foreach (var k in keys)
            {
                var n = info.Nodes[k];
                if (n == null) continue;
                var v = n.Nodes.Count > 0 ? "{" + string.Join(",", n.Nodes.Select(c => c.Text + "=" + c.Value)) + "}" : n.Value?.ToString() ?? "";
                counts[k][cat] = counts[k].GetValueOrDefault(cat) + 1;
                if (samples[k].Count < 25) samples[k].Add($"{id} {cat} {names.GetValueOrDefault(id)} = {v}");
            }
        });
    }
    foreach (var k in keys)
    {
        Console.WriteLine($"## {k}: " + string.Join(", ", counts[k].Select(kv => $"{kv.Key}={kv.Value}")));
        foreach (var s in samples[k]) Console.WriteLine("   " + s);
    }
    return;
}

if (opts.TryGetValue("table", out var tableKeys))
{
    // TSV of every equip: id, category, name, then the raw value of each requested info key ("" when absent,
    // "{n}" for a node with n children). Tabs / line breaks inside values become spaces (some names contain them).
    var names = LoadEquipNames(root);
    var keys = tableKeys.Split(',');
    static string Cell(string? v) => (v ?? "").Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ');
    Console.WriteLine("id\tcategory\tname\t" + string.Join("\t", keys));
    foreach (var (cat, id, img) in EnumerateEquipImgs(character))
        WithInfo(img, info => Console.WriteLine($"{id}\t{cat}\t{Cell(names.GetValueOrDefault(id))}\t" +
            string.Join("\t", keys.Select(k => info.Nodes[k] is { } n ? (n.Nodes.Count > 0 ? "{" + n.Nodes.Count + "}" : Cell(n.Value?.ToString())) : ""))));
    return;
}

var outDir = opts.GetValueOrDefault("out") ?? throw new ArgumentException("--out <dir> (or --probe/--flags/--table) is required");
Export(root, character, Path.GetFullPath(outDir));
return;

// ---------------------------------------------------------------------------

static void Export(Wz_Node root, Wz_Node character, string outDir)
{
    var names = LoadEquipNames(root);
    var equipDir = Path.Combine(outDir, "equip");
    if (Directory.Exists(equipDir)) Directory.Delete(equipDir, true);
    Directory.CreateDirectory(equipDir);

    var byCategory = new SortedDictionary<string, SortedDictionary<int, JsonObject>>(StringComparer.Ordinal);
    var index = new List<JsonObject>();
    var slotCodes = new SortedSet<string>(StringComparer.Ordinal);
    var negativeReqJob = new SortedDictionary<int, List<int>>();
    var magicMismatch = new List<string>();
    var unnamed = 0;
    var excluded = new SortedDictionary<string, int>(StringComparer.Ordinal);
    var variants = new Dictionary<int, Variant>();
    var seenIds = new HashSet<int>();
    var hasPrefix1552 = EnumerateEquipImgs(character).Any(e => e.Category == "Weapon" && e.Id / 1000 == 1552);
    // 1254 = TMS 陰陽扇 (Kanna; magician-only, incMAD > incPAD on 76/78 items) - TMS addition to the plan list.
    var magicPrefixes = new HashSet<int> { 1212, 1252, 1254, 1262, 1282, 1372, 1382 };
    if (hasPrefix1552) magicPrefixes.Add(1552);

    foreach (var (cat, id, img) in EnumerateEquipImgs(character))
    {
        WithInfo(img, info =>
        {
            var name = names.GetValueOrDefault(id);
            name ??= "";
            var slot = Str(info, "islot") ?? "";
            if (slot != "") slotCodes.Add(slot);
            var level = IntLoose(info, "reqLevel");
            var tuc = Int(info, "tuc");
            var cash = Int(info, "cash") == 1;
            var setIdRaw = Int(info, "setItemID");
            int? setId = setIdRaw > 0 ? setIdRaw : null;

            var reqJob = IntLoose(info, "reqJob");
            if (reqJob < 0) { if (!negativeReqJob.TryGetValue(reqJob, out var ids)) negativeReqJob[reqJob] = ids = new(); ids.Add(id); }
            JsonNode jobs = JobsOf(reqJob);

            var prefix3 = id / 10000;
            var prefix4 = id / 1000;
            var isWeapon = cat == "Weapon" && prefix3 != 135;
            var isMagicWeapon = isWeapon && magicPrefixes.Contains(prefix4);
            var pad = Int(info, "incPAD");
            var mad = Int(info, "incMAD");
            if (isWeapon && (pad > 0 || mad > 0) && isMagicWeapon != (mad > pad))
                magicMismatch.Add($"{id} {name} (incPAD={pad}, incMAD={mad}, isMagicWeapon={isMagicWeapon.ToString().ToLowerInvariant()})");

            var bossReward = Int(info, "bossReward") == 1;
            // No WZ starforce-forbid flag is known (exceptUpgrade's meaning is unconfirmed: Destiny weapons carry it yet are 22★).
            // 172xxxx 阿斯特拉 secondaries have tuc = 0 but are star-forced in real data (fixture 19–25★); see README.
            var astraSecondary = prefix3 == 172 && slot == "Si";
            var canStarforce = (tuc > 0 || astraSecondary) && !cash;
            var canFlame = FlameOverrides.TryGetValue(id, out var flameOverride) ? flameOverride.CanFlame : !cash && FlameCategory(cat, slot, prefix3);
            // Flame rules (line count / tier range) follow bossReward except for explicit overrides (README).
            var flameBoss = flameOverride.FlameBoss ?? bossReward;
            var timeLimited = Int(info, "timeLimited") == 1;
            var fixedPotential = Int(info, "fixedPotential") == 1;
            var eventVariant = Int(info, "exceptTransmission") == 1 || Int(info, "undecomposable") == 1;
            var accountShare = Int(info, "accountSharable") == 1 || Int(info, "sharableOnce") == 1;
            var untradeable = Int(info, "tradeBlock") == 1; // not equipTradeBlock (bind on equip): used for the 綁定版 label
            var exceptionalMax = Math.Max(0, Int(info, "Etuc"));
            var canExceptional = exceptionalMax > 0;
            var tradeBlock = Int(info, "tradeBlock") == 1 || Int(info, "equipTradeBlock") == 1;
            var superior = Int(info, "superiorEqp") == 1;
            var blockGoldHammer = Int(info, "blockGoldHammer") == 1;

            var baseStats = new JsonObject();
            foreach (var (wzKey, statKey) in StatMap)
            {
                var v = Int(info, wzKey);
                if (v != 0) baseStats[statKey] = v;
            }

            var equip = new JsonObject
            {
                ["id"] = id, ["name"] = name, ["category"] = cat, ["slot"] = slot, ["level"] = level,
                ["jobs"] = jobs, ["isWeapon"] = isWeapon, ["isMagicWeapon"] = isMagicWeapon,
                ["base"] = baseStats, ["tuc"] = tuc, ["cash"] = cash, ["setId"] = setId,
                ["bossReward"] = bossReward, ["canStarforce"] = canStarforce, ["canFlame"] = canFlame,
                ["canExceptional"] = canExceptional, ["tradeBlock"] = tradeBlock,
                ["superior"] = superior, ["blockGoldHammer"] = blockGoldHammer, ["exceptionalMax"] = exceptionalMax,
                ["flameBoss"] = flameBoss, ["timeLimited"] = timeLimited, ["fixedPotential"] = fixedPotential,
                ["eventVariant"] = eventVariant, ["accountShare"] = accountShare,
            };
            if (!seenIds.Add(id)) { Console.Error.WriteLine($"WARN duplicate id {id} in {cat}, keeping first"); return; }
            // Test / placeholder equipment is not exported at all (neither equip/ nor index.json); see ExcludeRule.
            // GM-stat items (STR/DEX/INT/LUK all ≥ 999, e.g. 維澤特帽 1002140/1003142) are excluded as well.
            var gmStats = new[] { "str", "dex", "int", "luk" }.All(k => (baseStats[k]?.GetValue<int>() ?? 0) >= 999);
            if ((gmStats ? "gm-stats" : ExcludeRule(id, name)) is { } rule) { excluded[rule] = excluded.GetValueOrDefault(rule) + 1; return; }
            if (!byCategory.TryGetValue(cat, out var map)) byCategory[cat] = map = new();
            map[id] = equip;
            // Unnamed items stay in equip/<category>.json but are not searchable via index.json.
            if (string.IsNullOrWhiteSpace(name)) { unnamed++; return; }
            index.Add(new JsonObject
            {
                ["id"] = id, ["name"] = name, ["category"] = cat, ["slot"] = slot, ["level"] = level,
                ["cash"] = cash, ["tuc"] = tuc, ["setId"] = setId, ["jobs"] = JobsOf(reqJob),
            });
            variants[id] = new Variant(slot, name, cash, eventVariant, timeLimited, fixedPotential, untradeable);
        });
    }

    foreach (var (cat, map) in byCategory)
    {
        var obj = new JsonObject();
        foreach (var (id, e) in map) obj[id.ToString(CultureInfo.InvariantCulture)] = e;
        WriteJson(Path.Combine(equipDir, cat + ".json"), obj);
    }
    index.Sort((a, b) => a["id"]!.GetValue<int>().CompareTo(b["id"]!.GetValue<int>()));
    var equipById = byCategory.Values.SelectMany(m => m).ToDictionary(kv => kv.Key, kv => kv.Value);
    var (labelCounts, fallbackCounts) = LabelVariants(index, variants, equipById);
    WriteJson(Path.Combine(outDir, "index.json"), new JsonArray(index.ToArray<JsonNode>()));

    WriteJson(Path.Combine(outDir, "meta.json"), new JsonObject
    {
        ["dataVersion"] = $"TMS v{ClientVersion}",
        ["exportedAt"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture),
        ["client"] = "TMS",
        ["version"] = ClientVersion,
    });

    WriteJson(Path.Combine(outDir, "sets.json"), ExportSets(root));

    var slotNames = new JsonObject();
    foreach (var code in slotCodes)
    {
        if (!SlotNames.TryGetValue(code, out var zh)) { Console.Error.WriteLine($"WARN no Chinese name for islot '{code}', using code"); zh = code; }
        slotNames[code] = zh;
    }
    WriteJson(Path.Combine(outDir, "slot-names.json"), slotNames);

    var potential = ExportPotentialOptions(root);
    var potentialPath = Path.Combine(outDir, "potential-options.json");
    if (potential != null) WriteJson(potentialPath, potential);
    else if (File.Exists(potentialPath)) File.Delete(potentialPath);

    Console.WriteLine($"Exported {byCategory.Values.Sum(m => m.Count)} equips in {byCategory.Count} categories ({index.Count} in index.json) to {outDir}");
    Console.WriteLine("Per category: " + string.Join(", ", byCategory.Select(kv => $"{kv.Key}={kv.Value.Count}")));
    Console.WriteLine($"Items without a String name (kept in equip/, excluded from index.json): {unnamed}");
    Console.WriteLine($"Excluded test/placeholder items ({excluded.Values.Sum()}): " + string.Join(", ", excluded.Select(kv => $"{kv.Key}={kv.Value}")));
    Console.WriteLine($"Magic prefixes: {string.Join(",", magicPrefixes.Order())} (1552 present: {hasPrefix1552})");
    Console.WriteLine($"Variants: {index.Count(e => e["canonical"]!.GetValue<bool>())} canonical, " +
        $"{index.Count(e => e["variantLabel"]!.GetValue<string>() != "")} labelled, " +
        $"{index.Count(e => !e["canonical"]!.GetValue<bool>() && e["variantLabel"]!.GetValue<string>() == "")} non-canonical without label");
    Console.WriteLine("Variant labels: " + string.Join(", ", labelCounts.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key}={kv.Value}")));
    Console.WriteLine("Fallback labels: " + string.Join(", ", fallbackCounts.Select(kv => $"{kv.Key}={kv.Value}")));
    Console.WriteLine("Negative reqJob: " + (negativeReqJob.Count == 0 ? "none" : string.Join(", ", negativeReqJob.Select(kv => $"{kv.Key} x{kv.Value.Count} [{string.Join(",", kv.Value)}]"))));
    Console.WriteLine($"Magic-weapon cross-check mismatches ({magicMismatch.Count}):");
    foreach (var m in magicMismatch) Console.WriteLine("  WARN " + m);
}

// Index variants: within each (slot, name, cash) group exactly one entry is canonical — the one with the fewest of
// eventVariant / timeLimited / fixedPotential (normally none), ties → lowest id. exceptUpgrade is NOT used
// (Destiny weapons carry it). Non-canonical entries get variantLabel = 活動版・期限・固定潛能 parts in that order,
// or 綁定版 when none apply and the entry is untradeable (info/tradeBlock) while the canonical one is not.
// Still empty → fallback from the first EquipData field that differs from the canonical (controller ruling):
// tuc → 可上卷N次, level → Lv.N, base → 數值不同, any other field (category, jobs, flags…) → #<id>;
// identical in every field except id → '' (the UI collapses those).
// Returns entry count per non-empty label and per fallback kind. Mutates the index entries (adds canonical / variantLabel).
static (Dictionary<string, int> Labels, Dictionary<string, int> Fallbacks) LabelVariants(
    List<JsonObject> index, Dictionary<int, Variant> variants, Dictionary<int, JsonObject> equipById)
{
    var counts = new Dictionary<string, int>(StringComparer.Ordinal);
    var fallbacks = new Dictionary<string, int>(StringComparer.Ordinal) { ["可上卷N次"] = 0, ["Lv.N"] = 0, ["數值不同"] = 0, ["#<id>"] = 0, ["identical"] = 0 };
    // Cash and non-cash entries never compete (controller ruling): e.g. cash 紅鷹鋼盔 1000009 vs non-cash 1000054.
    var groups = index.GroupBy(e => { var v = variants[e["id"]!.GetValue<int>()]; return (v.Slot, v.Name, v.Cash); });
    foreach (var g in groups)
    {
        var members = g.Select(e => (Entry: e, Id: e["id"]!.GetValue<int>())).ToList();
        int Score(int id) { var v = variants[id]; return (v.Event ? 1 : 0) + (v.TimeLimited ? 1 : 0) + (v.FixedPotential ? 1 : 0); }
        var canonicalId = members.OrderBy(m => Score(m.Id)).ThenBy(m => m.Id).First().Id;
        var canonicalUntradeable = variants[canonicalId].Untradeable;
        foreach (var (entry, id) in members)
        {
            var isCanonical = id == canonicalId;
            var label = "";
            if (!isCanonical)
            {
                var v = variants[id];
                var parts = new List<string>();
                if (v.Event) parts.Add("活動版");
                if (v.TimeLimited) parts.Add("期限");
                if (v.FixedPotential) parts.Add("固定潛能");
                if (parts.Count == 0 && v.Untradeable && !canonicalUntradeable) parts.Add("綁定版");
                label = string.Join("・", parts);
                if (label != "") counts[label] = counts.GetValueOrDefault(label) + 1;
                else
                {
                    var (kind, text) = FallbackLabel(equipById[id], equipById[canonicalId]);
                    fallbacks[kind]++;
                    label = text;
                }
            }
            entry["canonical"] = isCanonical;
            entry["variantLabel"] = label;
        }
    }
    return (counts, fallbacks);
}

// First differing calc field of an entry vs its group's canonical → (kind, label); ("identical", "") when equal except id.
static (string Kind, string Label) FallbackLabel(JsonObject e, JsonObject canonical)
{
    // Compare serialized forms (null-valued keys such as setId compare as "null").
    static string Ser(JsonNode? n) => n?.ToJsonString(JsonOpts) ?? "null";
    bool Same(string key) => Ser(e[key]) == Ser(canonical[key]);
    if (!Same("tuc")) return ("可上卷N次", $"可上卷{e["tuc"]!.GetValue<int>()}次");
    if (!Same("level")) return ("Lv.N", $"Lv.{e["level"]!.GetValue<int>()}");
    if (!Same("base")) return ("數值不同", "數值不同");
    foreach (var (key, _) in e)
        if (key != "id" && !Same(key)) return ("#<id>", $"#{e["id"]!.GetValue<int>()}");
    foreach (var (key, _) in canonical)
        if (key != "id" && !e.ContainsKey(key)) return ("#<id>", $"#{e["id"]!.GetValue<int>()}");
    return ("identical", "");
}

// Test / placeholder equipment excluded from the export (user decision, Task 1b); name-based, cash items included.
// Returns the first matching rule, or null to keep. Checked against the KEEP list in equip-data.spec.ts
// (測試用ESP限制器 1262001/1262018/1262022/1262060, 烏勒斯的握力測試機, 名譽開發者, 祕密團體臨時成員, English medals);
// Explicit ids: 1932236 "2014 horse" (placeholder mount, user-confirmed).
static string? ExcludeRule(int id, string name)
{
    if (id is 1932236) return "explicit-id";                                                 // "2014 horse"
    if (name.Contains("dummy", StringComparison.OrdinalIgnoreCase)) return "dummy";            // e.g. 1302362 1702207_dummy
    if (name.Length is >= 1 and <= 3 && name.All(char.IsAsciiLetter)) return "ascii1-3";     // e.g. "aa" 1932565
    if (name.Contains("GM", StringComparison.Ordinal)) return "GM";                          // e.g. 1007171 楓之谷GM的帽子
    if (name.Any(c => c is >= '\uAC00' and <= '\uD7A3')) return "hangul";                    // untranslated KMS-only items
    return null;
}

static JsonNode JobsOf(int reqJob)
{
    if (reqJob <= 0) return JsonValue.Create("all")!;
    var arr = new JsonArray();
    foreach (var (bit, job) in new[] { (1, "warrior"), (2, "magician"), (4, "bowman"), (8, "thief"), (16, "pirate") })
        if ((reqJob & bit) != 0) arr.Add(JsonValue.Create(job));
    return arr;
}

// KMS rule (estimate): weapons, armor and face/eye/earring/pendant/belt/pocket accessories.
static bool FlameCategory(string cat, string slot, int prefix3)
{
    if (prefix3 == 135) return false; // secondary weapons
    return cat switch
    {
        "Weapon" or "Cap" or "Coat" or "Longcoat" or "Pants" or "Shoes" or "Glove" or "Cape" => true,
        "Accessory" => slot is "Af" or "Ay" or "Ae" or "Pe" or "Be" or "Po",
        _ => false,
    };
}

static JsonObject ExportSets(Wz_Node root)
{
    var sets = new JsonObject();
    var setImg = root.FindNodeByPath(@"Etc\SetItemInfo.img") ?? throw new InvalidOperationException("Etc/SetItemInfo.img missing");
    var image = setImg.GetValue<Wz_Image>() ?? throw new InvalidOperationException("SetItemInfo.img not an image");
    if (!image.TryExtract(out var ex)) throw new InvalidOperationException("SetItemInfo.img extract failed", ex);
    foreach (var s in image.Node.Nodes.OrderBy(n => int.TryParse(n.Text, out var v) ? v : int.MaxValue))
    {
        if (!int.TryParse(s.Text, out var setId)) continue;
        sets[setId.ToString(CultureInfo.InvariantCulture)] = new JsonObject
        {
            ["name"] = Str(s, "setItemName") ?? "",
            ["completeCount"] = Int(s, "completeCount"),
        };
    }
    image.Unextract();
    return sets;
}

// Item/ItemOption.img: potential options. grade = id / 10000 (raw; meaning resolved in Task 3).
static JsonArray? ExportPotentialOptions(Wz_Node root)
{
    var node = root.FindNodeByPath(@"Item\ItemOption.img");
    var image = node?.GetValue<Wz_Image>();
    if (image == null || !image.TryExtract()) { Console.Error.WriteLine("WARN Item/ItemOption.img unavailable; potential-options.json not written"); return null; }
    var list = new JsonArray();
    foreach (var opt in image.Node.Nodes)
    {
        if (!int.TryParse(opt.Text, out var id)) continue;
        var info = opt.Nodes["info"];
        var text = info == null ? null : Str(info, "string");
        if (string.IsNullOrEmpty(text)) continue;
        var levels = new JsonObject();
        var lv = opt.Nodes["level"];
        if (lv != null)
            foreach (var l in lv.Nodes)
            {
                var vals = new JsonObject();
                foreach (var v in l.Nodes)
                {
                    if (v.Nodes.Count > 0) continue;
                    var raw = v.Value?.ToString() ?? "";
                    vals[v.Text] = int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var iv) ? iv : raw;
                }
                levels[l.Text] = vals;
            }
        var entry = new JsonObject { ["id"] = id, ["grade"] = id / 10000, ["text"] = text };
        if (info != null)
            foreach (var extra in new[] { "optionType", "reqLevel", "weight" })
                if (info.Nodes[extra] != null) entry[extra] = Int(info, extra);
        entry["levels"] = levels;
        list.Add(entry);
    }
    image.Unextract();
    return list;
}

static Dictionary<int, string> LoadEquipNames(Wz_Node root)
{
    var node = root.FindNodeByPath(@"String\Eqp.img") ?? throw new InvalidOperationException("String/Eqp.img missing");
    var image = node.GetValue<Wz_Image>() ?? throw new InvalidOperationException("Eqp.img not an image");
    if (!image.TryExtract(out var ex)) throw new InvalidOperationException("Eqp.img extract failed", ex);
    var names = new Dictionary<int, string>();
    void Walk(Wz_Node n, int depth)
    {
        foreach (var c in n.Nodes)
        {
            if (int.TryParse(c.Text, out var id) && c.Nodes["name"] != null)
            {
                var nm = c.Nodes["name"].Value?.ToString();
                if (nm != null) names.TryAdd(id, nm);
            }
            else if (depth < 4) Walk(c, depth + 1);
        }
    }
    Walk(image.Node, 0);
    return names;
}

// Every equip image (id 1,000,000–1,999,999) under Character/<category>/ and the Character root.
static IEnumerable<(string Category, int Id, Wz_Node Img)> EnumerateEquipImgs(Wz_Node character)
{
    foreach (var sub in character.Nodes.Prepend(character))
    {
        var cat = sub == character ? "Character" : sub.Text;
        foreach (var img in sub.Nodes)
        {
            if (!img.Text.EndsWith(".img", StringComparison.Ordinal)) continue;
            if (!int.TryParse(img.Text.AsSpan(0, img.Text.Length - 4), NumberStyles.None, CultureInfo.InvariantCulture, out var id)) continue;
            if (id < 1_000_000 || id >= 2_000_000) continue;
            yield return (cat, id, img);
        }
    }
}

// Runs action on <img>/info if present; returns false when the image has no info node.
static bool WithInfo(Wz_Node img, Action<Wz_Node> action)
{
    var image = img.GetValue<Wz_Image>();
    if (image == null) return false;
    if (!image.TryExtract(out var ex)) throw new InvalidOperationException($"extract failed: {img.FullPath}", ex);
    try
    {
        var info = image.Node.Nodes["info"];
        if (info == null) return false;
        action(info);
        return true;
    }
    finally { image.Unextract(); }
}

static string? Str(Wz_Node parent, string key) => parent.Nodes[key]?.Value?.ToString();

// Some items store the key with a trailing space ("reqLevel ", "reqJob "); use it when the exact key is absent.
static int IntLoose(Wz_Node parent, string key) => parent.Nodes[key] != null ? Int(parent, key) : Int(parent, key + " ");

static int Int(Wz_Node parent, string key)
{
    var v = parent.Nodes[key]?.Value;
    return v switch
    {
        null => 0,
        int i => i,
        short s => s,
        long l => checked((int)l),
        float f => (int)f,
        double d => (int)d,
        string str => int.TryParse(str.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var r) ? r : 0,
        _ => 0,
    };
}

static void WriteJson(string path, JsonNode node)
{
    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    var json = node.ToJsonString(JsonOpts);
    File.WriteAllText(path, json, new System.Text.UTF8Encoding(false));
}

static void Dump(Wz_Node n, string ind)
{
    var v = n.Value;
    var vs = v switch { null => "", Wz_Png => "<png>", Wz_Uol u => "uol:" + u.Uol, Wz_Vector vec => $"({vec.X},{vec.Y})", _ => v.ToString() };
    Console.WriteLine($"{ind}{n.Text} = {vs}");
    if (v is not Wz_Png && n.Nodes.Count is > 0 and < 40) foreach (var c in n.Nodes) Dump(c, ind + "  ");
}

static Dictionary<string, string> ParseArgs(string[] a)
{
    var d = new Dictionary<string, string>();
    for (int i = 0; i < a.Length; i++)
        if (a[i].StartsWith("--", StringComparison.Ordinal))
            d[a[i][2..]] = i + 1 < a.Length && !a[i + 1].StartsWith("--", StringComparison.Ordinal) ? a[++i] : "true";
    return d;
}

record Variant(string Slot, string Name, bool Cash, bool Event, bool TimeLimited, bool FixedPotential, bool Untradeable);

partial class Program
{
    // Per-id flame overrides (README "canFlame / flameBoss overrides"); FlameBoss null = follow bossReward.
    static readonly Dictionary<int, (bool CanFlame, bool? FlameBoss)> FlameOverrides = new()
    {
        [1143471] = (true, null),  // 不朽的遺產 (medal): KMS exception "Immortal Legacy"; 6/6 fixture flames solve under boss rules
        [1202287] = (true, false), // 古代石板複製品 (totem): KMS exception "Ancient Tablet Replica"; WZ bossReward=1 but 8/8 fixture flames solve only under non-boss rules
    };

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = false,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping, // keep CJK and "+" literal; output is data, not HTML
        TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver(),
    };

    // WZ info key -> StatKey (types.ts). Keys not listed (incACC, incEVA, incMDD, ...) are not exported.
    static readonly (string Wz, string Stat)[] StatMap =
    {
        ("incSTR", "str"), ("incDEX", "dex"), ("incINT", "int"), ("incLUK", "luk"),
        ("incMHP", "maxHp"), ("incMMP", "maxMp"), ("incPAD", "att"), ("incMAD", "matt"),
        ("incPDD", "def"), ("incSpeed", "speed"), ("incJump", "jump"),
        ("bdR", "bossDamage"), ("imdR", "ignoreDef"), ("damR", "damagePct"),
        ("incMHPr", "maxHpPct"), ("incMMPr", "maxMpPct"),
    };

    // islot code -> zh-TW slot name (manual table; WZ has no localized slot names).
    static readonly Dictionary<string, string> SlotNames = new(StringComparer.Ordinal)
    {
        ["Cp"] = "帽子", ["HrCp"] = "帽子", ["Ma"] = "上衣", ["MaPn"] = "套服", ["Pn"] = "褲/裙",
        ["So"] = "鞋子", ["Gv"] = "手套", ["Sr"] = "披風", ["Si"] = "副手", ["Wp"] = "單手武器",
        ["WpSi"] = "雙手武器", ["Af"] = "臉飾", ["Ay"] = "眼飾", ["Ae"] = "耳環", ["Pe"] = "墜飾",
        ["Be"] = "腰帶", ["Me"] = "勳章", ["Sh"] = "肩膀裝飾", ["Po"] = "口袋道具", ["Ri"] = "戒指",
        ["Ba"] = "徽章", ["Bi"] = "位元", ["Tm"] = "騎寵/機器人", ["Sd"] = "馬鞍", ["Ss"] = "技能外觀",
    };
}
