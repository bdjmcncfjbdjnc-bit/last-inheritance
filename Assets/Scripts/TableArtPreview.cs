using UnityEngine;

public sealed class TableArtPreview : MonoBehaviour
{
    public Light[] tableLights;
    public Camera viewCamera;
    public Renderer[] flameRenderers = System.Array.Empty<Renderer>();
    private Quaternion seatedRotation;
    private bool showHelp = true;
    public bool gameplayControlled;
    private float yawOffset;
    private float pitchOffset;

    private void Start()
    {
        seatedRotation = viewCamera.transform.localRotation;
#if UNITY_WEBGL && !UNITY_EDITOR
        showHelp = false;
#endif
    }

    private void Update()
    {
        if (!gameplayControlled && Input.GetKeyDown(KeyCode.L))
            ToggleTableLights();
        if (Input.GetKeyDown(KeyCode.H)) showHelp = !showHelp;
        if (Input.GetMouseButton(1))
        {
            float yaw = Mathf.Clamp(Input.GetAxis("Mouse X"), -4f, 4f);
            float pitch = Mathf.Clamp(Input.GetAxis("Mouse Y"), -4f, 4f);
            yawOffset = Mathf.Clamp(yawOffset + yaw * 1.5f,-72f,72f);
            pitchOffset = Mathf.Clamp(pitchOffset - pitch * 1.5f,-28f,36f);
            viewCamera.transform.localRotation = seatedRotation * Quaternion.Euler(pitchOffset,yawOffset,0);
        }
        if (Input.GetKeyDown(KeyCode.R)) { yawOffset=0;pitchOffset=0;viewCamera.transform.localRotation = seatedRotation; }
    }

    public void ToggleTableLights()
    {
        foreach (Light lamp in tableLights) lamp.enabled = !lamp.enabled;
        foreach (Renderer flame in flameRenderers) flame.enabled = tableLights[0].enabled;
    }

    public void ResetSeatPose() { seatedRotation=viewCamera.transform.localRotation;yawOffset=0;pitchOffset=0; }

    private void OnGUI()
    {
        if (!showHelp || gameplayControlled) return;
        GUI.color = new Color(0.88f, 0.78f, 0.62f, 0.85f);
        GUI.Label(new Rect(24, Screen.height - 40, 850, 30), "ART PREVIEW    /    RMB  Look around    /    L  Lights    /    R  Reset view    /    H  Hide help");
    }
}
