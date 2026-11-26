using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

[InitializeOnLoad]
public static class TestTableRuntime
{
    private static int frame;
    static TestTableRuntime(){if(SessionState.GetBool("InheritanceRuntimeQA",false))EditorApplication.update+=Tick;}
    [MenuItem("Last Inheritance/Verify four runtime seats")]
    public static void Run()
    {
        EditorSceneManager.OpenScene("Assets/Scenes/InheritanceDiningRoom.unity");
        SessionState.SetBool("InheritanceRuntimeQA",true);frame=0;
        EditorApplication.update-=Tick;EditorApplication.update+=Tick;EditorApplication.isPlaying=true;
    }
    private static void Tick()
    {
        if(!EditorApplication.isPlaying||EditorApplication.isCompiling)return;
        frame++;
        if(frame<40||frame%20!=0)return;
        int index=(frame-40)/20;
        try
        {
            var view=UnityEngine.Object.FindFirstObjectByType<TableSessionView>();
            if(view==null)throw new Exception("Runtime game view is missing");
            if(index<4){view.ApplyState("{\"phase\":\"debate\",\"me\":"+index+",\"selected\":-1,\"coins\":5,\"bank\":60}");Capture("Gameplay-Seat"+index);}
            else if(index==4){view.ApplyState("{\"phase\":\"dark\",\"me\":0,\"selected\":-1,\"coins\":6,\"bank\":-1}");view.PerformAction("steal");Capture("Gameplay-Blackout");}
            else{SessionState.SetBool("InheritanceRuntimeQA",false);EditorApplication.update-=Tick;Debug.Log("FOUR_SEAT_RUNTIME_QA_COMPLETE");EditorApplication.isPlaying=false;EditorApplication.delayCall+=()=>EditorApplication.Exit(0);}
        }
        catch(Exception error){SessionState.SetBool("InheritanceRuntimeQA",false);Debug.LogException(error);EditorApplication.Exit(1);}
    }
    private static void Capture(string name)
    {
        Directory.CreateDirectory("ArtResearch/Verification");
        var target=RenderTexture.GetTemporary(1600,900,24);var camera=Camera.main;camera.targetTexture=target;camera.Render();
        var previous=RenderTexture.active;RenderTexture.active=target;var image=new Texture2D(1600,900,TextureFormat.RGB24,false);
        image.ReadPixels(new Rect(0,0,1600,900),0,0);image.Apply();File.WriteAllBytes("ArtResearch/Verification/"+name+".png",image.EncodeToPNG());
        camera.targetTexture=null;RenderTexture.active=previous;RenderTexture.ReleaseTemporary(target);UnityEngine.Object.Destroy(image);
        Debug.Log("RUNTIME_SEAT_CAPTURE "+name);
    }
}
