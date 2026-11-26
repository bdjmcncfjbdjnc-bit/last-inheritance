Shader "Hidden/InheritanceFilm"
{
    Properties { _MainTex ("Scene", 2D) = "white" {} }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            fixed4 frag(v2f_img input) : SV_Target
            {
                float3 color = tex2D(_MainTex, input.uv).rgb;
                float luminance = dot(color, float3(0.2126, 0.7152, 0.0722));
                color = lerp(luminance.xxx, color, 0.88);
                float2 centered = input.uv - 0.5;
                float vignette = 1.0 - dot(centered, centered) * 0.48;
                float grain = frac(sin(dot(input.uv * _ScreenParams.xy, float2(12.9898,78.233))) * 43758.5453) - 0.5;
                color = color * vignette + grain * 0.009;
                return fixed4(max(color, 0), 1);
            }
            ENDCG
        }
    }
}
