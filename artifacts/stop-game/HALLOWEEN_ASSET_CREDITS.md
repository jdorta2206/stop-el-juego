# Halloween 2026 — Asset credits

## Visual

**Scary clown.jpg** — Graeme Maclean, Wikimedia Commons.  
License: **CC BY 2.0**.  
Source: https://commons.wikimedia.org/wiki/File:Scary_clown.jpg  
Bundled copy source: https://github.com/dhh1128/codecraft.co/blob/8f2eff35c43961e1feddcc882571bc38eea09a6a/assets/scary-clown.jpg

## Scare audio

**scream.mp3** — bundled from the public repository **ncase/wbwwb**.  
The repository credits its “scream #1” source as Freesound and marks it **CC Zero / CC0**.  
Repository: https://github.com/ncase/wbwwb  
Freesound attribution recorded by that repository: scream #1 by GreatNate98.

## Integration

- Assets are bundled locally in the web app; there is no runtime request to Pixabay/Wikimedia/Freesound.
- The scream is preloaded before the scare and played as a real audio file, not synthesized with Web Audio.
- The image is a real raster photograph, not CSS/SVG-generated artwork.
- The scare overlay remains pointer-events-none.
- No rapid repeated flashing is used; the reveal uses one smooth opacity transition plus slow image motion.
