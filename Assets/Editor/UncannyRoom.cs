using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

public static class UncannyRoom
{
    private static Material wood;
    private static Material brass;
    private static Material shadow;
    private static Material paper;

    public static Light[] Dress(Material darkWood, Material oldBrass)
    {
        wood = darkWood;
        brass = oldBrass;
        shadow = MakeMaterial("Soot and deep shadow", new Color(0.008f, 0.011f, 0.012f));
        paper = MakeMaterial("Old bone paper", new Color(0.5f, 0.43f, 0.3f));
        var lights = new List<Light>();
        Picture(new Vector3(-1.65f, 2.22f, 3.07f), new Vector2(0.4f,0.57f), -7);
        Picture(new Vector3(-1.65f, 1.56f, 3.07f), new Vector2(0.32f,0.43f), 5);
        Picture(new Vector3(0.77f, 2.57f, 3.07f), new Vector2(0.4f,0.3f), 8);
        Picture(new Vector3(-2.1f, 2.5f, 3.07f), new Vector2(0.32f,0.42f), -4);
        Clock(new Vector3(0.85f, 0, 3.02f));
        Doll(new Vector3(-2.49f, 1.25f, 2.29f));
        CorridorFigure();
        Curtain(new Vector3(3.3f, 1.85f, 3.05f));
        TablePhotographs();
        lights.Add(Candle(new Vector3(-0.36f,0.79f,0.22f),0.19f));
        lights.Add(Candle(new Vector3(-0.48f,0.79f,0.28f),0.12f));
        Scratches();
        Web(new Vector3(-3.85f,2.85f,3.14f));
        return lights.ToArray();
    }

    private static Material MakeMaterial(string name, Color color, float smoothness = 0.1f)
    {
        string path = "Assets/Art/Materials/" + name + ".mat";
        Material material = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (material == null)
        {
            material = new Material(Shader.Find("Standard"));
            AssetDatabase.CreateAsset(material,path);
        }
        material.color = color;
        material.SetFloat("_Glossiness",smoothness);
        EditorUtility.SetDirty(material);
        return material;
    }

    private static GameObject Shape(string name, PrimitiveType primitive, Vector3 position, Vector3 scale, Material material, Transform parent = null)
    {
        GameObject item = GameObject.CreatePrimitive(primitive);
        item.name = name;
        item.transform.SetParent(parent,false);
        item.transform.localPosition = position;
        item.transform.localScale = scale;
        item.GetComponent<Renderer>().sharedMaterial = material;
        return item;
    }

    private static void Picture(Vector3 position, Vector2 size, float angle)
    {
        GameObject root = new GameObject("Crooked family photograph");
        root.transform.position = position;
        root.transform.rotation = Quaternion.Euler(0,0,angle);
        Shape("Old frame backing",PrimitiveType.Cube,Vector3.zero,new Vector3(size.x+0.055f,size.y+0.055f,0.04f),wood,root.transform);
        Material picture = MakeMaterial("Repeated family photo",new Color(0.65f,0.59f,0.46f));
        picture.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/Materials/FamilyPortrait.png");
        Shape("Photo paper",PrimitiveType.Quad,new Vector3(0,0,-0.025f),new Vector3(size.x,size.y,1),picture,root.transform);
    }

    private static void Clock(Vector3 origin)
    {
        GameObject clock = new GameObject("Silent grandfather clock");
        clock.transform.position = origin;
        Shape("Clock cabinet",PrimitiveType.Cube,new Vector3(0,1.19f,0),new Vector3(0.35f,2.38f,0.2f),wood,clock.transform);
        Shape("Clock dark recess",PrimitiveType.Cube,new Vector3(0,1.24f,-0.108f),new Vector3(0.24f,1.95f,0.022f),shadow,clock.transform);
        GameObject dial = Shape("Stained clock dial",PrimitiveType.Cylinder,new Vector3(0,2.08f,-0.14f),new Vector3(0.275f,0.009f,0.275f),paper,clock.transform);
        dial.transform.localRotation = Quaternion.Euler(90,0,0);
        for (int i = 0; i < 12; i++)
        {
            float radians = i*Mathf.PI/6;
            GameObject tick = Shape("Clock hour mark",PrimitiveType.Cube,new Vector3(Mathf.Sin(radians)*0.109f,2.08f+Mathf.Cos(radians)*0.109f,-0.153f),new Vector3(0.007f,0.021f,0.003f),shadow,clock.transform);
            tick.transform.localRotation = Quaternion.Euler(0,0,-i*30);
        }
        GameObject minute = Shape("Clock minute hand",PrimitiveType.Cube,new Vector3(-0.004f,2.13f,-0.158f),new Vector3(0.006f,0.103f,0.004f),shadow,clock.transform);
        minute.transform.localRotation = Quaternion.Euler(0,0,4);
        Shape("Clock hour hand",PrimitiveType.Cube,new Vector3(0.004f,2.115f,-0.161f),new Vector3(0.009f,0.071f,0.004f),shadow,clock.transform);
        Shape("Pendulum shaft",PrimitiveType.Cube,new Vector3(0,1.05f,-0.15f),new Vector3(0.012f,1.01f,0.012f),brass,clock.transform);
        Shape("Pendulum weight",PrimitiveType.Sphere,new Vector3(0,0.56f,-0.16f),new Vector3(0.15f,0.15f,0.03f),brass,clock.transform);
        Shape("Clock cornice",PrimitiveType.Cube,new Vector3(0,2.42f,0),new Vector3(0.43f,0.09f,0.26f),wood,clock.transform);
    }

    private static void Doll(Vector3 origin)
    {
        GameObject doll = DiningCast.Place("male-adult-03",origin+new Vector3(0,-0.16f,0),180);
        doll.name = "A miniature of the man across the table";
        doll.transform.localScale = Vector3.one*0.37f;
    }

    private static void CorridorFigure()
    {
        GameObject figure = new GameObject("Someone waiting beyond the door");
        figure.transform.position = new Vector3(2.04f,0,4.9f);
        Material face = MakeMaterial("Corridor figure face",new Color(0.055f,0.06f,0.055f));
        Shape("Long dark coat",PrimitiveType.Capsule,new Vector3(0,1.01f,0),new Vector3(0.32f,0.94f,0.18f),shadow,figure.transform);
        Shape("Uneven shoulders",PrimitiveType.Sphere,new Vector3(0,1.91f,0),new Vector3(0.42f,0.18f,0.2f),shadow,figure.transform);
        Shape("Long neck",PrimitiveType.Cylinder,new Vector3(0,2.01f,0),new Vector3(0.065f,0.1f,0.065f),face,figure.transform);
        GameObject head = Shape("Watcher head",PrimitiveType.Sphere,new Vector3(0.025f,2.22f,-0.015f),new Vector3(0.15f,0.29f,0.135f),face,figure.transform);
        head.transform.localRotation = Quaternion.Euler(0,0,-12);
        Shape("Watcher left socket",PrimitiveType.Sphere,new Vector3(-0.009f,2.235f,-0.078f),new Vector3(0.025f,0.016f,0.008f),shadow,figure.transform);
        Shape("Watcher right socket",PrimitiveType.Sphere,new Vector3(0.052f,2.225f,-0.078f),new Vector3(0.025f,0.016f,0.008f),shadow,figure.transform);
        Shape("Left hanging arm",PrimitiveType.Capsule,new Vector3(-0.22f,1.12f,0),new Vector3(0.055f,0.77f,0.065f),shadow,figure.transform);
        Shape("Right hanging arm",PrimitiveType.Capsule,new Vector3(0.22f,1.1f,0),new Vector3(0.055f,0.79f,0.065f),shadow,figure.transform);
    }

    private static void Curtain(Vector3 position)
    {
        Material cloth = MakeMaterial("Heavy wine curtains",new Color(0.15f,0.025f,0.035f));
        const string path = "Assets/Art/Materials/PleatedCurtain.asset";
        Mesh mesh = AssetDatabase.LoadAssetAtPath<Mesh>(path);
        if (mesh == null)
        {
            const int columns = 48;
            const int rows = 16;
            var vertices = new Vector3[(columns+1)*(rows+1)];
            var uv = new Vector2[vertices.Length];
            var indices = new int[columns*rows*6];
            int triangle = 0;
            for (int y = 0; y <= rows; y++)
            for (int x = 0; x <= columns; x++)
            {
                int index = y*(columns+1)+x;
                float u = x/(float)columns;
                float v = y/(float)rows;
                vertices[index] = new Vector3((u-0.5f)*0.88f,(v-0.5f)*1.86f+Mathf.Sin(u*27)*0.02f*(1-v),Mathf.Sin(u*42)*0.047f);
                uv[index] = new Vector2(u,v);
                if (x == columns || y == rows) continue;
                indices[triangle++] = index;
                indices[triangle++] = index+columns+1;
                indices[triangle++] = index+1;
                indices[triangle++] = index+1;
                indices[triangle++] = index+columns+1;
                indices[triangle++] = index+columns+2;
            }
            mesh = new Mesh {name="Heavy pleated curtain",vertices=vertices,uv=uv,triangles=indices};
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            AssetDatabase.CreateAsset(mesh,path);
        }
        GameObject curtain = new GameObject("Heavy pleated curtain",typeof(MeshFilter),typeof(MeshRenderer));
        curtain.transform.position = position;
        curtain.GetComponent<MeshFilter>().sharedMesh = mesh;
        curtain.GetComponent<Renderer>().sharedMaterial = cloth;
    }

    private static void TablePhotographs()
    {
        Material photo = MakeMaterial("Loose old photograph",new Color(0.65f,0.56f,0.42f));
        photo.mainTexture = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Art/Materials/FamilyPortrait.png");
        for (int i = 0; i < 3; i++)
        {
            GameObject card = Shape("Scattered family print",PrimitiveType.Quad,new Vector3(-0.3f+i*0.085f,0.786f+i*0.0007f,-0.21f+i*0.035f),new Vector3(0.14f,0.105f,1),photo);
            card.transform.rotation = Quaternion.Euler(90,i*19-15,0);
        }
        Shape("Old envelope",PrimitiveType.Cube,new Vector3(0.3f,0.786f,0.27f),new Vector3(0.17f,0.0015f,0.1f),paper).transform.rotation = Quaternion.Euler(0,-12,0);
    }

    private static Light Candle(Vector3 position, float height)
    {
        Material wax = MakeMaterial("Dirty candle wax",new Color(0.57f,0.46f,0.29f));
        Shape("Candle saucer",PrimitiveType.Cylinder,position,new Vector3(0.085f,0.003f,0.085f),brass);
        Shape("Melted candle",PrimitiveType.Cylinder,position+Vector3.up*(height*0.5f),new Vector3(0.032f,height*0.5f,0.032f),wax);
        for (int i = 0; i < 5; i++)
        {
            float angle=i*Mathf.PI*0.4f;
            Shape("Wax run",PrimitiveType.Capsule,position+new Vector3(Mathf.Sin(angle)*0.016f,height*(0.6f+i*0.04f),Mathf.Cos(angle)*0.016f),new Vector3(0.008f,0.02f+i*0.003f,0.008f),wax);
        }
        Material flame = MakeMaterial("Candle flame",new Color(1,0.52f,0.12f));
        flame.EnableKeyword("_EMISSION");
        flame.SetColor("_EmissionColor",new Color(1.9f,0.65f,0.12f));
        Shape("Candle flame",PrimitiveType.Sphere,position+Vector3.up*(height+0.017f),new Vector3(0.012f,0.033f,0.012f),flame);
        Light light = new GameObject("Small candle light",typeof(Light)).GetComponent<Light>();
        light.transform.position = position+Vector3.up*(height+0.035f);
        light.color = new Color(1,0.55f,0.2f);
        light.intensity = 0.2f;
        light.range = 1.15f;
        return light;
    }

    private static void Scratches()
    {
        Material cut = MakeMaterial("Old cuts in wood",new Color(0.045f,0.025f,0.016f));
        for (int i = 0; i < 11; i++)
        {
            GameObject scratch = Shape("Repeated scratch in tabletop",PrimitiveType.Cube,new Vector3(0.51f+i*0.012f,0.783f,-0.36f),new Vector3(0.0018f,0.001f,0.043f+(i%3)*0.012f),cut);
            scratch.transform.rotation = Quaternion.Euler(0,12+(i%4)*9,0);
        }
    }

    private static void Web(Vector3 corner)
    {
        Material thread = MakeMaterial("Dusty cobweb threads",new Color(0.16f,0.14f,0.12f));
        for (int i = 0; i < 6; i++)
        {
            LineRenderer strand = new GameObject("Corner web thread",typeof(LineRenderer)).GetComponent<LineRenderer>();
            strand.sharedMaterial = thread;
            strand.startWidth = 0.0015f;
            strand.endWidth = 0.001f;
            strand.positionCount = 3;
            strand.SetPositions(new[] {corner,corner+new Vector3(0.1f+i*0.04f,-0.12f-i*0.025f,-0.025f),corner+new Vector3(0.4f-i*0.035f,-0.45f+i*0.04f,-0.04f)});
        }
    }
}
