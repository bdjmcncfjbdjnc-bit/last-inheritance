using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

public static class DiningCast
{
    public static GameObject Place(string id, Vector3 position, float yaw, float width = 1f, bool handsOnly = false)
    {
        string folder = "Assets/Art/Cast/" + id;
        string path = folder + "/" + (handsOnly ? "PlayerHands" : id) + ".obj";
        GameObject source = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (source == null) throw new System.InvalidOperationException("Missing cast mesh " + path);
        GameObject person = (GameObject)PrefabUtility.InstantiatePrefab(source);
        GameObject root = new GameObject(handsOnly ? "Player forearms and hands" : id + " seated guest");
        person.transform.SetParent(root.transform, false);
        root.transform.SetPositionAndRotation(position, Quaternion.Euler(0, yaw, 0));
        root.transform.localScale = new Vector3(width, 1, 1);
        foreach (Renderer renderer in person.GetComponentsInChildren<Renderer>())
        {
            Material[] materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++)
            {
                string materialName = materials[i].name;
                string materialPath = "Assets/Art/Materials/Cast_" + id + "_" + materialName + ".mat";
                Material material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
                if (material == null)
                {
                    material = new Material(Shader.Find("Standard"));
                    AssetDatabase.CreateAsset(material, materialPath);
                }
                string albedo = Directory.GetFiles(folder, materialName + "_albedo.*").FirstOrDefault(p => !p.EndsWith(".meta"));
                if (albedo != null) material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>(albedo.Replace('\\', '/'));
                if (id == "male-adult-03" && materialName == "m004_head" && File.Exists("Assets/Art/Materials/DisturbedSkin.png"))
                    material.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/Materials/DisturbedSkin.png");
                bool skin = materialName.ToLowerInvariant().Contains("head") || materialName.ToLowerInvariant().Contains("skin");
                material.color = skin ? new Color(0.78f, 0.79f, 0.72f) : new Color(0.72f, 0.65f, 0.55f);
                material.SetFloat("_Glossiness", skin ? 0.36f : 0.12f);
                if (materialName.ToLowerInvariant().Contains("opacity"))
                {
                    material.SetFloat("_Mode", 1);
                    material.SetFloat("_Cutoff", 0.35f);
                    material.EnableKeyword("_ALPHATEST_ON");
                    material.renderQueue = 2450;
                }
                if (skin)
                {
                    material.EnableKeyword("_EMISSION");
                    material.SetColor("_EmissionColor", new Color(0.018f, 0.013f, 0.009f));
                }
                string normal = Directory.GetFiles(folder, materialName + "_normal.*").FirstOrDefault(p => !p.EndsWith(".meta"));
                if (normal != null)
                {
                    string normalPath = normal.Replace('\\', '/');
                    var importer = (TextureImporter)AssetImporter.GetAtPath(normalPath);
                    if (importer.textureType != TextureImporterType.NormalMap)
                    {
                        importer.textureType = TextureImporterType.NormalMap;
                        importer.SaveAndReimport();
                    }
                    material.SetTexture("_BumpMap", AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath));
                    material.EnableKeyword("_NORMALMAP");
                }
                materials[i] = material;
                EditorUtility.SetDirty(material);
            }
            renderer.sharedMaterials = materials;
        }
        if (!handsOnly)
        {
            Transform[] heads = person.GetComponentsInChildren<Transform>().Where(child => child.name.StartsWith("Head_") && child.GetComponent<Renderer>() != null).ToArray();
            if (heads.Length > 0)
            {
                Bounds bounds = heads[0].GetComponent<Renderer>().bounds;
                foreach (Transform head in heads) bounds.Encapsulate(head.GetComponent<Renderer>().bounds);
                GameObject pivot = new GameObject("Neck presence pivot");
                pivot.transform.SetParent(root.transform, false);
                pivot.transform.position = new Vector3(bounds.center.x, bounds.min.y + 0.025f, bounds.center.z);
                foreach (Transform head in heads) head.SetParent(pivot.transform, true);
                var presence = pivot.AddComponent<GuestPresence>();
                presence.phase = Mathf.Abs(position.x * 3.7f + yaw * 0.03f);
            }
        }
        return root;
    }
}
