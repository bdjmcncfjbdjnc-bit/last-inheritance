using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class ExportArtPreview
{
    [MenuItem("Last Inheritance/Export browser art preview")]
    public static void Build()
    {
        const string output = "WebPreview/dist/client";
        Directory.CreateDirectory(output);
        // A table scene does not need 2K maps on every small prop and costume.
        // Keep original source images and cap their imported browser copies.
        int optimized=0;
        foreach(string guid in AssetDatabase.FindAssets("t:Texture2D",new[]{"Assets/Art"}))
        {
            string path=AssetDatabase.GUIDToAssetPath(guid);
            var importer=AssetImporter.GetAtPath(path) as TextureImporter;
            if(importer==null)continue;
            if(importer.maxTextureSize>1024||importer.isReadable)
            {
                importer.maxTextureSize=Mathf.Min(importer.maxTextureSize,1024);
                importer.isReadable=false;importer.textureCompression=TextureImporterCompression.Compressed;
                importer.SaveAndReimport();optimized++;
            }
        }
        Debug.Log("BROWSER_TEXTURES_OPTIMIZED "+optimized);
        EditorSceneManager.OpenScene("Assets/Scenes/InheritanceDiningRoom.unity");
        if (GameObject.Find("TableSession") == null) new GameObject("TableSession",typeof(TableSessionView));
        EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene());
        // Avoid stale split files being mistaken for the next complete data export.
        string oldBuild=Path.Combine(output,"Build");
        if(Directory.Exists(oldBuild))foreach(string generated in Directory.GetFiles(oldBuild))File.Delete(generated);
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.dataCaching = true;
        PlayerSettings.runInBackground = true;
        BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { "Assets/Scenes/InheritanceDiningRoom.unity" },
            locationPathName = output,
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        });
        if (report.summary.result != BuildResult.Succeeded)
            throw new BuildFailedException("Browser preview export failed: " + report.summary.result);

        string build = Path.Combine(output,"Build");
        string loader = Path.GetFileName(Directory.GetFiles(build,"*.loader.js").Single());
        string data = Path.GetFileName(Directory.GetFiles(build,"*.data*").Single());
        string framework = Path.GetFileName(Directory.GetFiles(build,"*.framework.js*").Single());
        string wasm = Path.GetFileName(Directory.GetFiles(build,"*.wasm*").Single());
        string page = File.ReadAllText("WebPreview/client/index.template.html");
        var parts = new System.Collections.Generic.List<string>();
        using (var input = File.OpenRead(Path.Combine(build,data))) {
            byte[] buffer = new byte[20 * 1024 * 1024];
            int count;
            while ((count = input.Read(buffer,0,buffer.Length)) > 0) {
                string part = data + ".part" + parts.Count;
                using (var destination = File.Create(Path.Combine(build,part))) destination.Write(buffer,0,count);
                parts.Add("\"" + part + "\"");
            }
        }
        File.Delete(Path.Combine(build,data));
        page = page.Replace("__DATA_PARTS__","[" + string.Join(",",parts) + "]");
        page = page.Replace("__LOADER__",loader).Replace("__DATA__",data).Replace("__FRAMEWORK__",framework).Replace("__WASM__",wasm);
        File.WriteAllText(Path.Combine(output,"index.html"),page);
        File.Copy("Assets/Art/Cast/male-adult-03/NOTICE.txt",Path.Combine(output,"ThirdPartyNotices.txt"),true);
        File.WriteAllText(Path.Combine(output,"preview-version.json"),"{\"version\":\"multiplayer-04\",\"scope\":\"eight-rounds-four-players\"}");
        Debug.Log("BROWSER_ART_PREVIEW_BUILD_COMPLETE " + report.summary.totalSize);
    }
}
