import { Engine } from "../Engines/engine";
import { IDisposable, Scene } from "../scene";
import { Nullable } from "../types";
import { Vector2, Vector3 } from "../Maths/math.vector";
import { Texture } from "../Materials/Textures/texture";
import { RawTexture } from "../Materials/Textures/rawTexture";
import { ShaderMaterial } from "../Materials/shaderMaterial";
import { Mesh } from "../Meshes/mesh";
import { PickingInfo } from "../Collisions/pickingInfo";

import "../Meshes/Builders/planeBuilder";

/**
 * Defines the basic options interface of a SpriteMap
 */
export interface ISpriteMapOptions{

    /**
	 * Vector2 of the number of cells in the grid.
	 */
    stageSize?: Vector2;

    /**
	 * Vector2 of the size of the output plane in World Units.
	 */
    outputSize?: Vector2;

    /**
	 * Vector3 of the position of the output plane in World Units.
	 */
    outputPosition?: Vector3;

    //TODO ROTATION

    /**
	 * number of layers that the system will reserve in resources.
	 */
    layerCount?: number;

    /**
	 * number of max animation frames a single cell will reserve in resources.
	 */
    maxAnimationFrames?: number;

    /**
	 * number cell index of the base tile when the system compiles.
	 */
    baseTile?: number;

    /**
	* boolean flip the sprite after its been repositioned by the framing data.
	*/
    flipU?: boolean;

    /**
	 * Vector3 scalar of the global RGB values of the SpriteMap.
	 */
    colorMultiply?: Vector3;

}

/**
 * Defines the basic options interface of a Sprite Frame Source Size.
 */
export interface ISpriteJSONSpriteSourceSize{
    /**
	 * number of the original width of the Frame
	 */
    w : number;

    /**
     * number of the original height of the Frame
     */
    h : number;
}

/**
 * Defines the basic options interface of a Sprite Frame Data.
 */
export interface ISpriteJSONSpriteFrameData{
    /**
	 * number of the x offset of the Frame
	 */
    x : number;

    /**
	 * number of the y offset of the Frame
	 */
    y : number;

    /**
	 * number of the width of the Frame
	 */
    w : number;

    /**
     * number of the height of the Frame
     */
    h : number;
}

/**
 * Defines the basic options interface of a JSON Sprite.
 */
export interface ISpriteJSONSprite{
    /**
	 * string name of the Frame
	 */
    filename : string;

    /**
	 * ISpriteJSONSpriteFrame basic object of the frame data
	 */
    frame : ISpriteJSONSpriteFrameData;

    /**
    * boolean to flag is the frame was rotated.
    */
    rotated : boolean;

    /**
    * boolean to flag is the frame was trimmed.
    */
    trimmed : boolean;

    /**
	 * ISpriteJSONSpriteFrame basic object of the source data
	 */
    spriteSourceSize : ISpriteJSONSpriteFrameData;

    /**
	 * ISpriteJSONSpriteFrame basic object of the source data
	 */
    sourceSize : ISpriteJSONSpriteSourceSize;
}

/**
 * Defines the basic options interface of a JSON atlas.
 */
export interface ISpriteJSONAtlas{

    /**
	 * Array of objects that contain the frame data.
	 */
    frames: Array<ISpriteJSONSprite>;

    /**
	 * object basic object containing the sprite meta data.
	 */
    meta?: object;

}

/**
 * Defines the IDisposable interface in order to be cleanable from resources.
 */
export interface ISpriteMap extends IDisposable {

    /**
	 * String name of the SpriteMap.
	 */
    name: string;

    /**
	 * The JSON Array file from a https://www.codeandweb.com/texturepacker export.  Or similar structure.
	 */
    atlasJSON: ISpriteJSONAtlas;

    /**
	 * Texture of the SpriteMap.
	 */
    spriteSheet: Texture;

    /**
	 * The parameters to initialize the SpriteMap with.
	 */
    options: ISpriteMapOptions;

}

/**
 * Class used to manage a grid restricted sprite deployment on an Output plane.
 */
export class SpriteMap implements ISpriteMap {

    /** The Name of the spriteMap */
    public name: string;

    /** The JSON file with the frame and meta data */
    public atlasJSON: ISpriteJSONAtlas;

    /** The systems Sprite Sheet Texture */
    public spriteSheet: Texture;

    /** Arguments passed with the Constructor */
    public options: ISpriteMapOptions;

    /** Public Sprite Storage array, parsed from atlasJSON */
    public sprites: Array<ISpriteJSONSprite>;

    /** Returns the Number of Sprites in the System */
    public get spriteCount(): number {
        return this.sprites.length;
    }

    /** Returns the Position of Output Plane*/
    public get position(): Vector3 {
        return this._output.position;
    }

    /** Returns the Position of Output Plane*/
    public set position(v: Vector3) {
        this._output.position = v;
    }

    /** Sets the AnimationMap*/
    public get animationMap() {
        return this._animationMap;
    }

    /** Sets the AnimationMap*/
    public set animationMap(v: RawTexture) {
        let buffer = v!._texture!._bufferView;
        let am = this.createTileAnimationBuffer(buffer);
        this._animationMap.dispose();
        this._animationMap = am;
        this._material.setTexture('animationMap', this._animationMap);
    }

    /** Scene that the SpriteMap was created in */
    private _scene: Scene;

    /** Texture Buffer of Float32 that holds tile frame data*/
    private _frameMap: RawTexture;

    /** Texture Buffers of Float32 that holds tileMap data*/
    private _tileMaps: RawTexture[];

    /** Texture Buffer of Float32 that holds Animation Data*/
    private _animationMap: RawTexture;

    /** Custom ShaderMaterial Central to the System*/
    private _material: ShaderMaterial;

    /** Custom ShaderMaterial Central to the System*/
    private _output: Mesh;

    /** Systems Time Ticker*/
    private _time: number;

    /**
     * Creates a new SpriteMap
     * @param name defines the SpriteMaps Name
     * @param atlasJSON is the JSON file that controls the Sprites Frames and Meta
     * @param spriteSheet is the Texture that the Sprites are on.
     * @param options a basic deployment configuration
     * @param scene The Scene that the map is deployed on
     */
    constructor(name : string, atlasJSON: ISpriteJSONAtlas, spriteSheet: Texture, options: ISpriteMapOptions, scene : Scene) {

    this.name = name;
    this.sprites = [];
    this.atlasJSON = atlasJSON;
    this.sprites = this.atlasJSON['frames'];
    this.spriteSheet = spriteSheet;

    /**
    * Run through the options and set what ever defaults are needed that where not declared.
    */
    this.options = options;
    this.options.stageSize = this.options.stageSize || new Vector2(1, 1);
    this.options.outputSize = this.options.outputSize || this.options.stageSize;
    this.options.outputPosition = this.options.outputPosition || Vector3.Zero();
    this.options.layerCount = this.options.layerCount || 1;
    this.options.maxAnimationFrames = this.options.maxAnimationFrames || 0;
    this.options.baseTile = this.options.baseTile || 0;
    this.options.flipU = this.options.flipU || false;
    this.options.colorMultiply = this.options.colorMultiply || new Vector3(1, 1, 1);

    this._scene = scene;

    this._frameMap = this.createFrameBuffer();

    this._tileMaps = new Array();
    for (let i = 0; i < this.options.layerCount; i++) {
        this._tileMaps.push(this.createTileBuffer(null, i));
    }

    this._animationMap = this.createTileAnimationBuffer(null);

    let defines = [];
    defines.push("#define LAYERS " + this.options.layerCount);

    if (this.options.flipU) {
        defines.push("#define FLIPU");
    }

    this._material = new ShaderMaterial("spriteMap:" + this.name, this._scene, {
        vertex: "spriteMap",
        fragment: "spriteMap",
    }, {
        defines,
        attributes: ["position", "normal", "uv"],
        uniforms: [
            "worldViewProjection",
            "time",
            'stageSize',
            'outputSize',
            'spriteMapSize',
            'spriteCount',
            'time',
            'maxAnimationFrames',
            'colorMul',
            'mousePosition',
            'curTile',
            'flipU'
        ],
        samplers: [
           "spriteSheet", "frameMap", "tileMaps", "animationMap"
        ],
        needAlphaBlending: true
    });

    this._time = 0;

    this._material.setFloat('spriteCount', this.spriteCount);
    this._material.setFloat('maxAnimationFrames', this.options.maxAnimationFrames);
    this._material.setVector2('stageSize', this.options.stageSize);
    this._material.setVector2('outputSize', this.options.outputSize);
    this._material.setTexture('spriteSheet', this.spriteSheet);
    this._material.setVector2('spriteMapSize', new Vector2(1, 1));
    this._material.setVector3('colorMul', this.options.colorMultiply);

    let tickSave = 0;

    const bindSpriteTexture = () => {
        if ((this.spriteSheet) && this.spriteSheet.isReady()) {
            if (this.spriteSheet._texture) {
                this._material.setVector2('spriteMapSize', new Vector2(this.spriteSheet._texture.baseWidth || 1, this.spriteSheet._texture.baseHeight || 1));
                return;
            }
        }
        if (tickSave < 100) {
            setTimeout(() => {tickSave++; bindSpriteTexture(); }, 100);
        }
    };

    bindSpriteTexture();

    this._material.setVector3('colorMul', this.options.colorMultiply);
    this._material.setTexture("frameMap", this._frameMap);
    this._material.setTextureArray("tileMaps", this._tileMaps);
    this._material.setTexture("animationMap", this._animationMap);
    this._material.setFloat('time', this._time);

    this._output = Mesh.CreatePlane(name + ":output", 1, scene, true);
    this._output.scaling.x = this.options.outputSize.x;
    this._output.scaling.y = this.options.outputSize.y;

    let obfunction = () => {
        this._time += this._scene.getEngine().getDeltaTime();
        this._material.setFloat('time', this._time);
    };

    this._scene.onBeforeRenderObservable.add(obfunction);
    this._output.material = this._material;

    }

    /**
    * Returns tileID location
    * @returns Vector2 the cell position ID
    */
    public getTileID(): Vector2 {
        let p = this.getMousePosition();
        p.multiplyInPlace(this.options.stageSize || Vector2.Zero());
        p.x = Math.floor(p.x);
        p.y = Math.floor(p.y);
        return p;
    }

    /**
    * Gets the UV location of the mouse over the SpriteMap.
    * @returns Vector2 the UV position of the mouse interaction
    */
    public getMousePosition(): Vector2 {
        let out = this._output;
        var pickinfo: Nullable<PickingInfo> = this._scene.pick(this._scene.pointerX, this._scene.pointerY, (mesh) => {
            if (mesh !== out) {
                return false;
            }
          return true;
        });

        if (((!pickinfo) || !pickinfo.hit) || !pickinfo.getTextureCoordinates) {
            return new Vector2(-1, -1);
        }

        let coords = pickinfo.getTextureCoordinates();
        if (coords) {
            return coords;
        }

        return 	new Vector2(-1, -1);
    }

    /**
    * Creates the "frame" texture Buffer
    * -------------------------------------
    * Structure of frames
    *  "filename": "Falling-Water-2.png",
    * "frame": {"x":69,"y":103,"w":24,"h":32},
    * "rotated": true,
    * "trimmed": true,
    * "spriteSourceSize": {"x":4,"y":0,"w":24,"h":32},
    * "sourceSize": {"w":32,"h":32}
    * @returns RawTexture of the frameMap
    */
    private createFrameBuffer(): RawTexture {
        let data = new Array();
        //Do two Passes
        for (let i = 0; i < this.spriteCount; i++) {
            data.push(0, 0, 0, 0); //frame
            data.push(0, 0, 0, 0); //spriteSourceSize
            data.push(0, 0, 0, 0); //sourceSize, rotated, trimmed
            data.push(0, 0, 0, 0); //Keep it pow2 cause I'm cool like that... it helps with sampling accuracy as well. Plus then we have 4 other parameters for future stuff.
        }
        //Second Pass
        for (let i = 0; i < this.spriteCount; i++) {
            let f = this.sprites[i]['frame'];
            let sss = this.sprites[i]['spriteSourceSize'];
            let ss = this.sprites[i]['sourceSize'];
            let r = (this.sprites[i]['rotated']) ? 1 : 0;
            let t = (this.sprites[i]['trimmed']) ? 1 : 0;

            //frame
            data[i * 4] = f.x;
            data[i * 4 + 1] = f.y;
            data[i * 4 + 2] = f.w;
            data[i * 4 + 3] = f.h;
            //spriteSourceSize
            data[i * 4 + (this.spriteCount * 4)] = sss.x;
            data[i * 4 + 1 + (this.spriteCount * 4)] = sss.y;
            data[i * 4 + 2 + (this.spriteCount * 4)] = sss.w;
            data[i * 4 + 3 + (this.spriteCount * 4)] = sss.h;
            //sourceSize, rotated, trimmed
            data[i * 4 + (this.spriteCount * 8)] = ss.w;
            data[i * 4 + 1 + (this.spriteCount * 8)] = ss.h;
            data[i * 4 + 2 + (this.spriteCount * 8)] = r;
            data[i * 4 + 3 + (this.spriteCount * 8)] = t ;
        }

        let floatArray = new Float32Array(data);

        let t = RawTexture.CreateRGBATexture(
        floatArray,
        this.spriteCount,
        4,
        this._scene,
        false,
        false,
        Texture.NEAREST_NEAREST,
        Engine.TEXTURETYPE_FLOAT
        );

        return t;
    }

    /**
    * Creates the tileMap texture Buffer
    * @param buffer normally and array of numbers, or a false to generate from scratch
    * @param _layer indicates what layer for a logic trigger dealing with the baseTile.  The system uses this
    * @returns RawTexture of the tileMap
    */
    private createTileBuffer(buffer: any, _layer: number = 0): RawTexture {

        let data = new Array();
        let _ty = (this.options.stageSize!.y) || 0;
        let _tx = (this.options.stageSize!.x) || 0;

        if (!buffer) {
            let bt = this.options.baseTile;
            if (_layer != 0) {
                bt = 0;
            }

            for (let y = 0; y < _ty; y++) {
                for (let x = 0; x < _tx * 4; x += 4) {
                    data.push(bt, 0, 0, 0);
                }
            }
        } else {
            data = buffer;
        }

        let floatArray = new Float32Array(data);
        let t = RawTexture.CreateRGBATexture(
        floatArray,
        _tx,
        _ty,
        this._scene,
        false,
        false,
        Texture.NEAREST_NEAREST,
        Engine.TEXTURETYPE_FLOAT
        );

        return t;
    }

    /**
    * Modifies the data of the tileMaps
    * @param _layer is the ID of the layer you want to edit on the SpriteMap
    * @param pos is the iVector2 Coordinates of the Tile
    * @param tile The SpriteIndex of the new Tile
    */
    public changeTiles(_layer: number = 0, pos: any , tile: number = 0): void {

        let buffer: any = [];
        buffer = this._tileMaps[_layer]!._texture!._bufferView;
        if (!buffer) {
            return;
        }

        let p = new Array();
        if (pos instanceof Vector2) {
            p.push(pos);
        } else {
            p = pos;
        }

        let _tx = (this.options.stageSize!.x) || 0;

        for (let i = 0; i < p.length; i++) {
            let _p = p[i];
            _p.x = Math.floor(_p.x);
            _p.y = Math.floor(_p.y);
            let id = (_p.x * 4) + (_p.y * (_tx * 4));
            buffer[id] = tile;
        }

        let t = this.createTileBuffer(buffer);
        this._tileMaps[_layer].dispose();
        this._tileMaps[_layer] = t;
        this._material.setTextureArray("tileMap", this._tileMaps);
    }

    /**
    * Creates the animationMap texture Buffer
    * @param buffer normally and array of numbers, or a false to generate from scratch
    * @returns RawTexture of the animationMap
    */
    private createTileAnimationBuffer(buffer: any): RawTexture {
        let data = new Array();
        if (!buffer) {
            for (let i = 0; i < this.spriteCount; i++) {
                data.push(0, 0, 0, 0);
                let count = 1;
                while (count < (this.options.maxAnimationFrames || 4)) {
                    data.push(0, 0, 0, 0);
                    count++;
                }
            }
        } else {
            data = buffer;
        }

        let floatArray = new Float32Array(data);
        let t = RawTexture.CreateRGBATexture(
        floatArray,
        this.spriteCount,
        (this.options.maxAnimationFrames || 4),
        this._scene,
        false,
        false,
        Texture.NEAREST_NEAREST,
        Engine.TEXTURETYPE_FLOAT
        );

        return t;
    }
    /**
    * Modifies the data of the animationMap
    * @param cellID is the Index of the Sprite
    * @param _frame is the target Animation frame
    * @param toCell is the Target Index of the next frame of the animation
    * @param time is a value between 0-1 that is the trigger for when the frame should change tiles
    * @param speed is a global scalar of the time variable on the map.
    */
    public addAnimationToTile(cellID: number = 0, _frame: number = 0, toCell: number = 0, time: number = 0, speed: number = 1): void {
        let buffer: any = this._animationMap!._texture!._bufferView;
        let id: number = (cellID * 4) + (this.spriteCount * 4 * _frame);
        if (!buffer) {
            return;
        }
        buffer[id || 0] = toCell;
        buffer[id + 1 || 0] = time;
        buffer[id + 2 || 0] = speed;
        let t = this.createTileAnimationBuffer(buffer);
        this._animationMap.dispose();
        this._animationMap = t;
        this._material.setTexture("animationMap", this._animationMap);
    }

    /**
    * Exports the .tilemaps file
    */
    public saveTileMaps(): void {
        let maps = '';
        for (var i = 0; i < this._tileMaps.length; i++) {
            if (i > 0) {maps += '\n\r'; }

            maps += this._tileMaps[i]!._texture!._bufferView!.toString();
        }
        var hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:octet/stream;charset=utf-8,' + encodeURI(maps);
        hiddenElement.target = '_blank';
        hiddenElement.download = this.name + '.tilemaps';
        hiddenElement.click();
        hiddenElement.remove();
    }

    /**
    * Imports the .tilemaps file
    * @param url of the .tilemaps file
    */
    public loadTileMaps(url : string) : void {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", url);

        let _lc =  this.options!.layerCount || 0;

        xhr.onload = () =>
        {
            let data = xhr.response.split('\n\r');
            for (let i = 0; i < _lc; i++) {
                let d = (data[i].split(',')).map(Number);
                let t = this.createTileBuffer(d);
                this._tileMaps[i].dispose();
                this._tileMaps[i] = t;
            }
            this._material.setTextureArray("tileMap", this._tileMaps);
        };
        xhr.send();
    }

    /**
     * Release associated resources
     */
    public dispose(): void {
        this._output.dispose();
        this._material.dispose();
        this._animationMap.dispose();
        this._tileMaps.forEach((tm) => {
            tm.dispose();
        });
        this._frameMap.dispose();
    }
}