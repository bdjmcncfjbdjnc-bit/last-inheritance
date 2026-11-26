using UnityEngine;

[ExecuteAlways]
public sealed class DiningFilm : MonoBehaviour
{
    public Material treatment;

    private void OnRenderImage(RenderTexture source, RenderTexture destination)
    {
        if (treatment != null) Graphics.Blit(source, destination, treatment);
        else Graphics.Blit(source, destination);
    }
}
