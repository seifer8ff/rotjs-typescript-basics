import { compressJpg, compressPng } from '@assetpack/plugin-compress';
import { audio } from '@assetpack/plugin-ffmpeg';
import { json } from '@assetpack/plugin-json';
import { pixiManifest } from '@assetpack/plugin-manifest';
import { pixiTexturePacker } from '@assetpack/plugin-texture-packer';
import { webfont } from '@assetpack/plugin-webfont';

export default {
    entry: './raw-assets',
    output: './dist/assets/',
    cache: false,
    plugins: {
        webfont: webfont(),
        compressJpg: compressJpg(),
        compressPng: compressPng(),
        audio: audio(),
        json: json(),
        texture: pixiTexturePacker({
            texturePacker: {
                removeFileExtension: true,
                extrude: 1
            },
        }),
        manifest: pixiManifest({
            output: './dist/assets/assets-manifest.json'
        }),
    },
};