using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

public static class DiningProps
{
    public static void CoinRim(Vector3 position, Material material)
    {
        Lathe("Token rim", new[] { new Vector2(0.024f, 0.0041f), new Vector2(0.0267f, 0.0045f), new Vector2(0.0274f, 0.0037f) }, position, material);
    }

    public static void Tumbler(Vector3 position)
    {
        const string materialPath = "Assets/Art/Materials/OldGlass.mat";
        Material glass = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
        if (glass == null)
        {
            glass = new Material(Shader.Find("Standard"));
            AssetDatabase.CreateAsset(glass, materialPath);
        }
        glass.color = new Color(0.8f, 0.74f, 0.61f, 0.22f);
        glass.SetFloat("_Mode", 3);
        glass.SetInt("_SrcBlend", (int)BlendMode.One);
        glass.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
        glass.SetInt("_ZWrite", 0);
        glass.SetFloat("_Glossiness", 0.95f);
        glass.EnableKeyword("_ALPHAPREMULTIPLY_ON");
        glass.renderQueue = 3000;
        EditorUtility.SetDirty(glass);
        GameObject tumbler = Lathe("Old drinking glass", new[] {
            new Vector2(0.001f,0), new Vector2(0.035f,0), new Vector2(0.041f,0.008f),
            new Vector2(0.047f,0.115f), new Vector2(0.044f,0.117f),
            new Vector2(0.038f,0.012f), new Vector2(0.001f,0.012f)
        }, position, glass);
        tumbler.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
    }

    private static GameObject Lathe(string name, Vector2[] profile, Vector3 position, Material material)
    {
        string path = "Assets/Art/Materials/" + name.Replace(' ', '_') + ".asset";
        Mesh mesh = AssetDatabase.LoadAssetAtPath<Mesh>(path);
        if (mesh == null)
        {
            const int sides = 40;
            var vertices = new Vector3[profile.Length * (sides + 1)];
            var uv = new Vector2[vertices.Length];
            var triangles = new int[(profile.Length - 1) * sides * 6];
            int triangle = 0;
            for (int row = 0; row < profile.Length; row++)
            for (int side = 0; side <= sides; side++)
            {
                int index = row * (sides + 1) + side;
                float angle = side * Mathf.PI * 2 / sides;
                vertices[index] = new Vector3(Mathf.Sin(angle) * profile[row].x, profile[row].y, Mathf.Cos(angle) * profile[row].x);
                uv[index] = new Vector2(side / (float)sides, row / (float)(profile.Length - 1));
                if (row == profile.Length - 1 || side == sides) continue;
                int next = index + sides + 1;
                triangles[triangle++] = index;
                triangles[triangle++] = next;
                triangles[triangle++] = index + 1;
                triangles[triangle++] = index + 1;
                triangles[triangle++] = next;
                triangles[triangle++] = next + 1;
            }
            mesh = new Mesh { name = name, vertices = vertices, uv = uv, triangles = triangles };
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            AssetDatabase.CreateAsset(mesh, path);
        }
        GameObject item = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
        item.transform.position = position;
        item.GetComponent<MeshFilter>().sharedMesh = mesh;
        item.GetComponent<MeshRenderer>().sharedMaterial = material;
        return item;
    }
}
