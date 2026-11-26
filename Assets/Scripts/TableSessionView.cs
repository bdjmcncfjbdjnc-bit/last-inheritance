using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Scripting;

[Preserve]
public sealed class TableSessionView : MonoBehaviour
{
    [Serializable] private class Player { public int seat; public string name; public bool online; }
    [Serializable] private class Snapshot { public string phase; public int me; public int selected; public int coins; public int bank; public Player[] players; }
    private TableArtPreview preview;
    private Transform hands;
    private Vector3 handRest;
    private Vector3 handBaseRest;
    private float actionTime = -10;
    private string gesture;
    private string phase = "lobby";
    private int selected = -1;
    private int me;
    private Light[] darken;
    private float[] intensities;
    private bool lightsOn = true;
    private readonly Dictionary<int, Renderer[]> heads = new Dictionary<int, Renderer[]>();
    private readonly List<GameObject> purse = new List<GameObject>();
    private readonly List<GameObject> pot = new List<GameObject>();
    private Material coinMaterial;
    private GameObject movingCoin;
    private Color ambientRest;
    private Camera cameraView;
    private int activeSeat = -1;
    private readonly Dictionary<int,GameObject> bodies=new Dictionary<int,GameObject>();
    private readonly Dictionary<int,Renderer[]> chairs=new Dictionary<int,Renderer[]>();
    private Transform privateItems;

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] private static extern void InheritancePick(int relativeSeat);
#endif

    private void Awake()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        WebGLInput.captureAllKeyboardInput = false;
#endif
        cameraView = Camera.main;
        preview = cameraView.GetComponent<TableArtPreview>();
        preview.gameplayControlled = true;
        ambientRest = RenderSettings.ambientLight;
        darken = FindObjectsByType<Light>(FindObjectsSortMode.None);
        intensities = darken.Select(light => light.intensity).ToArray();
        hands = GameObject.Find("Player forearms and hands")?.transform;
        if (hands != null) handRest = hands.localPosition;
        var opposite=GameObject.Find("male-adult-03 seated guest");
        if(opposite!=null){var fourth=Instantiate(opposite,new Vector3(0,0,-0.98f),Quaternion.identity);fourth.name="Fourth seated guest";fourth.transform.localScale=new Vector3(1.05f,1,1);}
        DressFrontWall();
        Vector3[] chairSeats={new Vector3(0,0,-1.28f),new Vector3(-1.24f,0,0.25f),new Vector3(0,0,0.9f),new Vector3(1.24f,0,0.25f)};
        foreach(Transform item in FindObjectsByType<Transform>(FindObjectsSortMode.None).Where(t=>t.name=="dining_chair_02 placement"))
        {
            Renderer[] renderers=item.GetComponentsInChildren<Renderer>();if(renderers.Length==0)continue;
            Bounds bounds=renderers[0].bounds;foreach(var renderer in renderers)bounds.Encapsulate(renderer.bounds);
            Vector3 center=new Vector3(bounds.center.x,0,bounds.center.z);
            int nearest=Enumerable.Range(0,4).OrderBy(i=>Vector3.Distance(center,chairSeats[i])).First();
            if(Vector3.Distance(center,chairSeats[nearest])<0.7f)chairs[nearest]=renderers;
        }
        string[] cast = { "Fourth seated guest", "female-adult-09 seated guest", "male-adult-03 seated guest", "male-adult-07 seated guest" };
        for (int i = 0; i < cast.Length; i++)
        {
            GameObject guest = GameObject.Find(cast[i]);
            if (guest == null) continue;
            bodies[i]=guest;
            heads[i] = guest.GetComponentsInChildren<Renderer>().Where(r => r.name.StartsWith("Head_")).ToArray();
            var target = new GameObject("Guest selection " + i);
            target.transform.position = new Vector3(i == 1 ? -1.03f : i == 3 ? 1.03f : 0, 1.22f, i == 0 ? -0.98f : i == 2 ? 0.87f : 0.3f);
            var box = target.AddComponent<BoxCollider>(); box.size = new Vector3(0.55f,0.85f,0.45f);
            target.AddComponent<TableGuestTarget>().seat = i;
        }
        // Existing piles were art dressing. Hide their arbitrary quantities in a live game.
        foreach (Renderer renderer in FindObjectsByType<Renderer>(FindObjectsSortMode.None))
            if (renderer.name.Contains("Inheritance brass token") || renderer.name.Contains("Coin rim") || renderer.name=="Token rim") renderer.enabled = false;
        coinMaterial = new Material(Shader.Find("Standard"));
        coinMaterial.color = new Color(0.57f,0.36f,0.12f); coinMaterial.SetFloat("_Metallic",0.72f); coinMaterial.SetFloat("_Glossiness",0.44f);
        for (int i=0;i<22;i++) purse.Add(Coin("Your private coin", new Vector3(-0.10f + (i%6)*0.042f,0.80f+(i/6)*0.006f,-0.54f+(i%3)*0.028f)));
        for (int i=0;i<20;i++) pot.Add(Coin("Coins in common dish", new Vector3(Mathf.Sin(i*2.4f)*0.15f,0.805f+(i%4)*0.006f,Mathf.Cos(i*2.4f)*0.09f)));
        movingCoin = Coin("Coin in your fingers",new Vector3(0,0.82f,-0.2f));movingCoin.SetActive(false);
        UpdateCoins(5,64);
        privateItems=new GameObject("Local seat items").transform;
        privateItems.position=new Vector3(0,0,0.1f);
        if(hands!=null){hands.position+=new Vector3(0,0,0.25f);hands.SetParent(privateItems,true);handBaseRest=hands.localPosition;handRest=handBaseRest;}
        foreach(var coin in purse){coin.transform.position+=new Vector3(0,0,0.14f);coin.transform.SetParent(privateItems,true);}
        ConfigureSeat(0);
    }

    private GameObject Coin(string label, Vector3 position)
    {
        GameObject coin = GameObject.CreatePrimitive(PrimitiveType.Cylinder); coin.name=label;
        coin.transform.position=position;coin.transform.localScale=new Vector3(0.038f,0.0028f,0.038f);
        coin.GetComponent<Renderer>().sharedMaterial=coinMaterial;Destroy(coin.GetComponent<Collider>());return coin;
    }

    private void DressFrontWall()
    {
        foreach(string suffix in new[]{"wallpaper","wainscot","dado rail","crown molding"})
        {
            GameObject source=GameObject.Find("Back left "+suffix);if(source==null)continue;
            var copy=Instantiate(source);copy.name="Front "+suffix;
            copy.transform.position=new Vector3(0,source.transform.position.y,-3.35f);
            var size=source.transform.localScale;size.x=8;copy.transform.localScale=size;
        }
        var portrait=GameObject.Find("Family portrait front");
        if(portrait!=null){var copy=Instantiate(portrait,new Vector3(0,2.07f,-3.21f),Quaternion.Euler(0,180,0));copy.name="Portrait facing the other seats";}
    }

    private void ConfigureSeat(int seat)
    {
        activeSeat=seat;
        foreach(var body in bodies)foreach(Renderer renderer in body.Value.GetComponentsInChildren<Renderer>())renderer.enabled=body.Key!=seat;
        foreach(var chair in chairs)foreach(Renderer renderer in chair.Value)renderer.enabled=chair.Key!=seat;
        Vector3[] positions={new Vector3(0,1.22f,-1.12f),new Vector3(-1.55f,1.22f,0.26f),new Vector3(0,1.22f,1.65f),new Vector3(1.55f,1.22f,0.26f)};
        Vector3[] aims={new Vector3(0,1.12f,0.65f),new Vector3(0.45f,1.12f,0.2f),new Vector3(0,1.12f,-0.6f),new Vector3(-0.45f,1.12f,0.2f)};
        cameraView.transform.position=positions[seat];cameraView.transform.LookAt(aims[seat]);
        preview.ResetSeatPose();if(privateItems!=null)privateItems.rotation=Quaternion.Euler(0,seat*90,0);
        if(hands!=null){handRest=handBaseRest+new Vector3(0,0,-new[]{0f,0.33f,0.28f,0.33f}[seat]);hands.localPosition=handRest;}
    }

    [Preserve] public void ApplyState(string json)
    {
        Snapshot snapshot=JsonUtility.FromJson<Snapshot>(json);phase=snapshot.phase;selected=snapshot.selected;me=snapshot.me;
        if(activeSeat!=me)ConfigureSeat(me);
        SetLights(phase!="dark");UpdateCoins(snapshot.coins,snapshot.bank);
        foreach(var pair in heads)
        {
            bool focus = selected == pair.Key;
            foreach(Renderer renderer in pair.Value)
            {
                var block=new MaterialPropertyBlock();renderer.GetPropertyBlock(block);
                block.SetColor("_EmissionColor",focus?new Color(0.17f,0.045f,0.025f):new Color(0.018f,0.013f,0.009f));renderer.SetPropertyBlock(block);
            }
        }
    }

    private void UpdateCoins(int amount,int bank)
    {
        for(int i=0;i<purse.Count;i++)purse[i].SetActive(i<amount);
        if(bank>=0)for(int i=0;i<pot.Count;i++)pot[i].SetActive(i<Mathf.CeilToInt(bank/3.2f));
    }

    private void SetLights(bool on)
    {
        if(lightsOn==on)return;lightsOn=on;
        for(int i=0;i<darken.Length;i++)darken[i].intensity=on?intensities[i]:intensities[i]*0.015f;
        foreach(Renderer flame in preview.flameRenderers)flame.enabled=on;
        RenderSettings.ambientLight=on?ambientRest:ambientRest*0.015f;
    }

    [Preserve] public void PerformAction(string kind) {gesture=kind;actionTime=Time.unscaledTime;}

    private void Update()
    {
        if(hands!=null)
        {
            float t=(Time.unscaledTime-actionTime)/0.7f;
            float reach=t<1f?Mathf.Sin(Mathf.Clamp01(t)*Mathf.PI):0;
            Vector3 offset=gesture=="steal"?new Vector3(0,0.015f,reach*0.32f):new Vector3(0,Mathf.Sin(reach*Mathf.PI)*0.035f,0);
            if(phase=="vote"&&selected>=0)
            {
                int rel=(selected-me+4)%4;offset+=new Vector3(rel==1?-0.09f:rel==3?0.09f:0,0.02f,0.12f);
            }
            hands.localPosition=Vector3.Lerp(hands.localPosition,handRest+offset,Time.unscaledDeltaTime*15f);
            movingCoin.SetActive(gesture=="steal"&&t>0.25f&&t<0.8f);
            movingCoin.transform.position=privateItems.TransformPoint(new Vector3(0.13f,0.825f,-0.55f+reach*0.28f));
        }
        if(Input.GetMouseButtonDown(0)&&phase=="vote")
        {
            Ray ray=cameraView.ScreenPointToRay(Input.mousePosition);
            foreach(RaycastHit hit in Physics.RaycastAll(ray,4f))
            {
                var target=hit.collider.GetComponent<TableGuestTarget>();if(target==null||target.seat==me)continue;
#if UNITY_WEBGL && !UNITY_EDITOR
                InheritancePick((target.seat-me+4)%4);
#endif
                break;
            }
        }
    }
}

public sealed class TableGuestTarget : MonoBehaviour { public int seat; }
