using UnityEngine;

public sealed class GuestPresence : MonoBehaviour
{
    public float phase;
    private Quaternion restRotation;

    private void Awake() { restRotation = transform.localRotation; }

    private void Update()
    {
        float time = Time.time + phase;
        float cycle = Mathf.Repeat(time,14f);
        float glance = Mathf.SmoothStep(0,1,Mathf.Clamp01((cycle-8f)/1.5f)) - Mathf.SmoothStep(0,1,Mathf.Clamp01((cycle-11f)/1.8f));
        transform.localRotation = restRotation * Quaternion.Euler(Mathf.Sin(time*0.35f)*0.12f,glance*3.1f,Mathf.Sin(time*0.2f)*0.15f);
    }
}
