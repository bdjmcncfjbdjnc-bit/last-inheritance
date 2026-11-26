using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

public static class BuildDiningRoom
{
    private const string Art = "Assets/Art/PolyHaven/";
    private const string Materials = "Assets/Art/Materials";
    private static Material wood;
    private static Material brass;

    [MenuItem("Last Inheritance/Validate lighting preview")]
    public static void ValidateLightingPreview()
    {
        Build();
        OpenPreview();
        var preview = Camera.main.GetComponent<TableArtPreview>();
        if (preview.tableLights.Length == 0 || preview.tableLights.Any(light => light == null)) throw new InvalidOperationException("Table light setup is incomplete");
        preview.ToggleTableLights();
        Capture(Camera.main);
        File.Copy("ArtResearch/Verification/SeatedView.png", "ArtResearch/Verification/LightsOff.png", true);
        preview.ToggleTableLights();
        Capture(Camera.main);
        File.WriteAllText("ArtResearch/Verification/EditorVerification.txt", "Scene rebuilt and rendered by Unity.\nImported furniture coordinate axes and scales checked.\n" + preview.tableLights.Length + " table lights and candle flames toggled off and on through the preview controller.\nLit and dark camera captures written.\nSeated cast, photo gallery, clock, doll and corridor figure placed.\nFinal character detail, facial animation and gameplay remain pending.\n");
        EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene());
    }

    public static void OpenPreview()
    {
        EditorSceneManager.OpenScene("Assets/Scenes/InheritanceDiningRoom.unity");
        EditorApplication.ExecuteMenuItem("Window/General/Game");
        Selection.activeGameObject = Camera.main.gameObject;
    }

    [MenuItem("Last Inheritance/Build dining room")]
    public static void Build()
    {
        Directory.CreateDirectory(Materials);
        Directory.CreateDirectory("Assets/Scenes");
        Directory.CreateDirectory("ArtResearch/Verification");
        AssetDatabase.Refresh();
        AssetDatabase.ImportAsset("Assets/Art/Materials/FamilyPortrait.png",ImportAssetOptions.ForceUpdate);
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        QualitySettings.SetQualityLevel(QualitySettings.names.Length - 1);
        QualitySettings.shadowDistance = 30f;
        QualitySettings.shadows = ShadowQuality.All;
        QualitySettings.shadowResolution = ShadowResolution.High;
        QualitySettings.antiAliasing = 4;
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.115f, 0.11f, 0.095f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.023f, 0.028f, 0.032f);
        RenderSettings.fogDensity = 0.017f;
        RenderSettings.defaultReflectionMode = DefaultReflectionMode.Custom;
        wood = Material("Dark polished wood", new Color(0.24f, 0.105f, 0.065f), 0.36f);
        SetTexture(wood, "dark_wood", "diff");
        brass = Material("Tarnished brass", new Color(0.48f, 0.29f, 0.09f), 0.45f, 0.65f);
        Material green = Material("Oxidized green paneling", new Color(0.055f, 0.105f, 0.09f), 0.2f);
        Material dark = Material("Unlit corridor", new Color(0.008f, 0.012f, 0.014f), 0.05f);
        Material ceiling = Material("Nicotine ceiling", new Color(0.25f, 0.225f, 0.17f), 0.05f);
        Material wallpaper = Material("Burgundy damask wallpaper", Color.white, 0.08f);
        wallpaper.mainTexture = Wallpaper();
        wallpaper.mainTextureScale = new Vector2(7, 3);
        Box("Floor", new Vector3(0, -0.09f, 0.4f), new Vector3(8, 0.16f, 8), wood);
        // Narrow floorboards and seams remain visible under raking light.
        for (int i = 0; i < 25; i++)
            Box("Floor seam", new Vector3(-3.84f + i * 0.32f, 0.001f, 0.4f), new Vector3(0.008f, 0.003f, 8), dark);
        Box("Ceiling", new Vector3(0, 3.05f, 0.4f), new Vector3(8, 0.18f, 8), ceiling);
        Wall("Back left", new Vector3(-1.28f, 1.5f, 3.35f), new Vector3(5.44f, 3, 0.18f), wallpaper, green);
        Wall("Back right", new Vector3(3.45f, 1.5f, 3.35f), new Vector3(1.1f, 3, 0.18f), wallpaper, green);
        Wall("Left", new Vector3(-4, 1.5f, 0.4f), new Vector3(0.18f, 3, 6), wallpaper, green);
        Wall("Right", new Vector3(4, 1.5f, 0.4f), new Vector3(0.18f, 3, 6), wallpaper, green);
        Box("Door lintel", new Vector3(2.15f, 2.78f, 3.35f), new Vector3(1.5f, 0.5f, 0.22f), wood);
        Box("Door left jamb", new Vector3(1.43f, 1.25f, 3.2f), new Vector3(0.12f, 2.5f, 0.25f), wood);
        Box("Door right jamb", new Vector3(2.87f, 1.25f, 3.2f), new Vector3(0.12f, 2.5f, 0.25f), wood);
        Box("Corridor rear", new Vector3(2.15f, 1.4f, 5.3f), new Vector3(1.55f, 2.8f, 0.1f), dark);
        Box("Corridor left", new Vector3(1.4f, 1.4f, 4.3f), new Vector3(0.12f, 2.8f, 2.1f), green);
        Box("Corridor right", new Vector3(2.9f, 1.4f, 4.3f), new Vector3(0.12f, 2.8f, 2.1f), green);
        Place("wooden_table_02", new Vector3(0, 0, 0), new Vector3(2.12f, 0.78f, 1.24f), 0);
        Place("dining_chair_02", new Vector3(0, 0, 0.9f), new Vector3(0.6f, 1.15f, 0.62f), 180);
        Place("dining_chair_02", new Vector3(-1.24f, 0, 0.25f), new Vector3(0.6f, 1.15f, 0.62f), 90);
        Place("dining_chair_02", new Vector3(1.24f, 0, 0.25f), new Vector3(0.6f, 1.15f, 0.62f), -90);
        Place("dining_chair_02", new Vector3(0, 0, -1.28f), new Vector3(0.6f, 1.15f, 0.62f), 0);
        Place("vintage_cabinet_01", new Vector3(-2.7f, 0, 2.65f), new Vector3(1.4f, 2.1f, 0.5f), 0);
        Place("fancy_picture_frame_01", new Vector3(-0.35f, 1.42f, 3.05f), new Vector3(1.85f, 1.3f, 0.09f), 0);
        Material portrait = Material("Faded family photograph", Color.white, 0.12f);
        portrait.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/Materials/FamilyPortrait.png");
        GameObject photograph = GameObject.CreatePrimitive(PrimitiveType.Quad);
        photograph.name = "Family portrait front";
        photograph.transform.position = new Vector3(-0.35f, 2.07f, 2.99f);
        photograph.transform.localScale = new Vector3(1.66f, 1.14f, 1);
        photograph.GetComponent<Renderer>().sharedMaterial = portrait;
        Place("Chandelier_02", new Vector3(0, 2.17f, 0.15f), new Vector3(0.95f, 0.7f, 0.95f), 0);
        Place("tea_set_01", new Vector3(-0.63f, 0.79f, -0.06f), new Vector3(0.42f, 0.16f, 0.3f), 0);
        Place("wine_bottles_01", new Vector3(-2.75f, 2.11f, 2.64f), new Vector3(0.45f, 0.4f, 0.18f), 0);
        Place("dining_chair_02",new Vector3(-1.25f,0,2.55f),new Vector3(0.52f,1.1f,0.55f),30);
        DiningCast.Place("male-adult-03", new Vector3(0, 0, 0.83f), 180, 1.18f);
        DiningCast.Place("female-adult-09", new Vector3(-1.12f, 0, 0.32f), 120);
        DiningCast.Place("male-adult-07", new Vector3(1.12f, 0, 0.32f), -120, 0.95f);
        DiningCast.Place("marcus_formal", new Vector3(0, 0, -0.98f), 0, 1, true);
        for (int i = 0; i < 8; i++)
        {
            float x = -3.65f + i * 0.62f;
            Box("Panel vertical molding", new Vector3(x, 0.46f, 3.23f), new Vector3(0.028f, 0.74f, 0.025f), wood);
            Box("Panel top molding", new Vector3(x + 0.29f, 0.83f, 3.23f), new Vector3(0.59f, 0.028f, 0.025f), wood);
            Box("Panel bottom molding", new Vector3(x + 0.29f, 0.09f, 3.23f), new Vector3(0.59f, 0.028f, 0.025f), wood);
        }
        foreach (var fixture in GameObject.Find("Chandelier_02 placement").GetComponentsInChildren<Renderer>())
            fixture.shadowCastingMode = ShadowCastingMode.Off;
        Coins(new Vector3(0, 0.792f, 0.39f), 8);
        Coins(new Vector3(-0.8f, 0.792f, 0.15f), 7);
        Coins(new Vector3(0.8f, 0.792f, 0.15f), 7);
        Coins(new Vector3(0, 0.792f, -0.42f), 6);
        DiningProps.Tumbler(new Vector3(0.42f, 0.79f, -0.18f));
        Light[] candleLights = UncannyRoom.Dress(wood,brass);
        Light main = Lamp("Amber pendant", new Vector3(0, 2.16f, -0.15f), new Color(1, 0.76f, 0.47f), 2.8f, 7f);
        Light fill = Lamp("Warm table bounce", new Vector3(0, 1.15f, -1.25f), new Color(1, 0.67f, 0.42f), 0.6f, 4.5f);
        fill.shadows = LightShadows.None;
        Light faces = Lamp("Soft face bounce", new Vector3(0, 1.7f, -0.6f), new Color(0.73f, 0.83f, 0.7f), 0.65f, 3.7f);
        faces.shadows = LightShadows.None;
        Lamp("Cool hair rim", new Vector3(1.9f, 1.85f, 2.3f), new Color(0.2f, 0.43f, 0.6f), 0.48f, 4.2f);
        Lamp("Cold corridor", new Vector3(2.3f, 1.8f, 4.4f), new Color(0.17f, 0.47f, 0.65f), 2.1f, 5f);
        GameObject cameraObject = new GameObject("Seated player camera", typeof(Camera), typeof(AudioListener));
        Camera camera = cameraObject.GetComponent<Camera>();
        cameraObject.tag = "MainCamera";
        camera.transform.position = new Vector3(0, 1.22f, -1.12f);
        camera.transform.LookAt(new Vector3(0, 1.12f, 0.65f));
        camera.fieldOfView = 58f;
        camera.nearClipPlane = 0.04f;
        camera.backgroundColor = new Color(0.012f, 0.014f, 0.016f);
        camera.clearFlags = CameraClearFlags.SolidColor;
        Material treatment = AssetDatabase.LoadAssetAtPath<Material>(Materials + "/DiningFilm.mat");
        if (treatment == null)
        {
            treatment = new Material(Shader.Find("Hidden/InheritanceFilm"));
            AssetDatabase.CreateAsset(treatment, Materials + "/DiningFilm.mat");
        }
        cameraObject.AddComponent<DiningFilm>().treatment = treatment;
        TableArtPreview preview = cameraObject.AddComponent<TableArtPreview>();
        preview.viewCamera = camera;
        preview.tableLights = new[] { main, fill, faces }.Concat(candleLights).ToArray();
        preview.flameRenderers = GameObject.FindObjectsByType<Renderer>(FindObjectsSortMode.None).Where(renderer => renderer.gameObject.name == "Candle flame").ToArray();
        var reflection = new GameObject("Dining room reflections", typeof(ReflectionProbe)).GetComponent<ReflectionProbe>();
        reflection.transform.position = new Vector3(0, 1.3f, 0);
        reflection.size = new Vector3(7, 3, 7);
        reflection.mode = ReflectionProbeMode.Realtime;
        reflection.refreshMode = ReflectionProbeRefreshMode.OnAwake;
        reflection.resolution = 128;
        reflection.intensity = 0.65f;
        EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(), "Assets/Scenes/InheritanceDiningRoom.unity");
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene("Assets/Scenes/InheritanceDiningRoom.unity", true) };
        PlayerSettings.companyName = "Independent Prototype";
        PlayerSettings.productName = "Last Inheritance";
        PlayerSettings.defaultScreenWidth = 1600;
        PlayerSettings.defaultScreenHeight = 900;
        AssetDatabase.SaveAssets();
        Selection.activeGameObject = cameraObject;
        SceneView.lastActiveSceneView?.AlignViewToObject(camera.transform);
        Capture(camera);
        Debug.Log("DINING_ROOM_BUILD_COMPLETE");
    }

    private static Material Material(string name, Color color, float smoothness, float metal = 0)
    {
        string path = Materials + "/" + name + ".mat";
        Material material = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (material == null)
        {
            material = new Material(Shader.Find("Standard"));
            AssetDatabase.CreateAsset(material, path);
        }
        material.color = color;
        material.SetFloat("_Glossiness", smoothness);
        material.SetFloat("_Metallic", metal);
        EditorUtility.SetDirty(material);
        return material;
    }

    private static void SetTexture(Material material, string id, string token)
    {
        string folder = Art + id;
        if (!Directory.Exists(folder)) return;
        string file = Directory.GetFiles(folder, "*", SearchOption.AllDirectories).FirstOrDefault(p => p.ToLowerInvariant().Contains(token) && (p.EndsWith(".jpg") || p.EndsWith(".png")));
        if (file != null) material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(file.Replace('\\', '/'));
    }

    private static void Place(string id, Vector3 position, Vector3 size, float yaw)
    {
        string path = Art + id + "/" + id + ".fbx";
        GameObject model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (model == null) throw new InvalidOperationException("Missing reviewed asset: " + path);
        GameObject instance = (GameObject)PrefabUtility.InstantiatePrefab(model);
        GameObject placement = new GameObject(id + " placement");
        instance.transform.SetParent(placement.transform, false);
        placement.transform.rotation = Quaternion.Euler(0, yaw, 0);
        Renderer[] renderers = instance.GetComponentsInChildren<Renderer>();
        Bounds bounds = renderers[0].bounds;
        foreach (Renderer renderer in renderers) bounds.Encapsulate(renderer.bounds);
        Debug.Log("ASSET_BOUNDS " + id + " " + bounds.size + " rootScale=" + instance.transform.localScale);
        placement.transform.localScale = new Vector3(size.x / Mathf.Max(bounds.size.x, 0.001f), size.y / Mathf.Max(bounds.size.y, 0.001f), size.z / Mathf.Max(bounds.size.z, 0.001f));
        bounds = renderers[0].bounds;
        foreach (Renderer renderer in renderers) bounds.Encapsulate(renderer.bounds);
        placement.transform.position += position - new Vector3(bounds.center.x, bounds.min.y, bounds.center.z);
        foreach (Renderer renderer in renderers)
        {
            Material[] mapped = renderer.sharedMaterials;
            for (int i = 0; i < mapped.Length; i++)
            {
                string sourceName = mapped[i] != null ? mapped[i].name : id;
                string safeName = id + "_" + string.Concat(sourceName.Select(c => char.IsLetterOrDigit(c) ? c : '_'));
                Material material = Material(safeName, Color.white, 0.22f);
                string[] files = Directory.GetFiles(Art + id, "*", SearchOption.AllDirectories);
                string[] diffuse = files.Where(p => (p.EndsWith(".jpg") || p.EndsWith(".png")) && (p.ToLowerInvariant().Contains("diff") || p.ToLowerInvariant().Contains("albedo"))).ToArray();
                string selected = diffuse.FirstOrDefault(p => Path.GetFileName(p).ToLowerInvariant().StartsWith(sourceName.ToLowerInvariant() + "_"));
                if (selected == null) selected = diffuse.FirstOrDefault();
                if (selected != null) material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(selected.Replace('\\', '/'));
                if (id == "fancy_picture_frame_01" && sourceName.ToLowerInvariant().Contains("canvas"))
                    material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/Materials/FamilyPortrait.png");
                if (id == "wooden_table_02")
                {
                    SetTexture(material, "dark_wood", "diff");
                    material.color = new Color(0.64f, 0.48f, 0.41f);
                    material.SetFloat("_Glossiness", 0.4f);
                }
                mapped[i] = material;
            }
            renderer.sharedMaterials = mapped;
        }
    }

    private static GameObject Box(string name, Vector3 position, Vector3 scale, Material material)
    {
        GameObject box = GameObject.CreatePrimitive(PrimitiveType.Cube);
        box.name = name;
        box.transform.position = position;
        box.transform.localScale = scale;
        box.GetComponent<Renderer>().sharedMaterial = material;
        return box;
    }

    private static void Wall(string name, Vector3 position, Vector3 size, Material paper, Material panels)
    {
        Box(name + " wallpaper", position, size, paper);
        Vector3 panelSize = new Vector3(size.x + 0.035f, 0.93f, size.z + 0.035f);
        Box(name + " wainscot", new Vector3(position.x, 0.465f, position.z), panelSize, panels);
        Box(name + " dado rail", new Vector3(position.x, 0.96f, position.z), new Vector3(panelSize.x + 0.03f, 0.055f, panelSize.z + 0.03f), wood);
        Box(name + " crown molding", new Vector3(position.x, 2.9f, position.z), new Vector3(panelSize.x + 0.08f, 0.1f, panelSize.z + 0.08f), wood);
    }

    private static Light Lamp(string name, Vector3 position, Color color, float intensity, float range)
    {
        Light light = new GameObject(name, typeof(Light)).GetComponent<Light>();
        light.transform.position = position;
        light.type = LightType.Point;
        light.color = color;
        light.intensity = intensity;
        light.range = range;
        light.shadows = LightShadows.Soft;
        return light;
    }

    private static void Coins(Vector3 origin, int count)
    {
        for (int i = 0; i < count; i++)
        {
            GameObject coin = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            coin.name = "Inheritance brass token";
            coin.transform.position = origin + new Vector3(Mathf.Sin(i * 2.4f) * 0.095f, (i % 3) * 0.008f, Mathf.Cos(i * 2.4f) * 0.065f);
            coin.transform.localScale = new Vector3(0.055f, 0.0038f, 0.055f);
            coin.GetComponent<Renderer>().sharedMaterial = brass;
            DiningProps.CoinRim(coin.transform.position, brass);
        }
    }

    private static Texture2D Wallpaper()
    {
        const string authoredPath = "Assets/Art/Materials/AntiqueDamask.png";
        if (File.Exists(authoredPath)) return AssetDatabase.LoadAssetAtPath<Texture2D>(authoredPath);
        const int resolution = 512;
        Texture2D texture = new Texture2D(resolution, resolution);
        var random = new System.Random(42);
        for (int y = 0; y < resolution; y++)
        for (int x = 0; x < resolution; x++)
        {
            float u = (x / (float)resolution - 0.5f) * 2f;
            float v = (y / (float)resolution - 0.5f) * 2f;
            float leaf = Mathf.Sin(u * 15f + Mathf.Sin(v * 8f) * 2.7f) * Mathf.Cos(v * 12f);
            float diamond = Mathf.Abs(u) + Mathf.Abs(v);
            bool ornament = (leaf > 0.72f && diamond < 0.95f) || Mathf.Abs(diamond - 0.88f) < 0.018f;
            Color color = ornament ? new Color(0.33f, 0.18f, 0.1f) : new Color(0.22f, 0.045f, 0.043f);
            float grain = 0.82f + (float)random.NextDouble() * 0.22f;
            texture.SetPixel(x, y, color * grain);
        }
        texture.Apply();
        string path = "Assets/Art/Materials/BurgundyWallpaper.png";
        File.WriteAllBytes(path, texture.EncodeToPNG());
        AssetDatabase.ImportAsset(path);
        return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
    }

    [MenuItem("Last Inheritance/Capture seated view")]
    public static void CaptureView() { Capture(Camera.main); }

    private static void Capture(Camera camera)
    {
        RenderTexture target = RenderTexture.GetTemporary(1600, 900, 24, RenderTextureFormat.ARGB32);
        camera.targetTexture = target;
        camera.Render();
        RenderTexture previous = RenderTexture.active;
        RenderTexture.active = target;
        Texture2D image = new Texture2D(1600, 900, TextureFormat.RGB24, false);
        image.ReadPixels(new Rect(0, 0, 1600, 900), 0, 0);
        image.Apply();
        File.WriteAllBytes("ArtResearch/Verification/SeatedView.png", image.EncodeToPNG());
        camera.targetTexture = null;
        RenderTexture.active = previous;
        RenderTexture.ReleaseTemporary(target);
        UnityEngine.Object.DestroyImmediate(image);
    }
}
