shader_type canvas_item;

uniform float key_threshold : hint_range(0.0, 1.0) = 0.86;
uniform float neutral_tolerance : hint_range(0.0, 1.0) = 0.08;
uniform float edge_softness : hint_range(0.001, 0.2) = 0.05;

void fragment() {
	vec4 tex = texture(TEXTURE, UV);
	float max_channel = max(tex.r, max(tex.g, tex.b));
	float min_channel = min(tex.r, min(tex.g, tex.b));
	float neutral = 1.0 - smoothstep(neutral_tolerance, neutral_tolerance + edge_softness, max_channel - min_channel);
	float bright = smoothstep(key_threshold, key_threshold + edge_softness, min_channel);
	float keyed = neutral * bright;
	COLOR = vec4(tex.rgb, tex.a * (1.0 - keyed));
}
