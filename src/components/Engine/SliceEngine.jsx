// src/components/Engine/SliceEngine.jsx
import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { vertexShaderSource, fragmentShaderSource, initShaderProgram } from '../../utils/sliceShaders';

export const ViewTypes = {
    AXIAL: 'axial',
    SAGITTAL: 'sagittal',
    CORONAL: 'coronal'
};

function SliceEngine({ volumeData, sliceOffset = 0.5, viewType = ViewTypes.AXIAL }) {
    const canvasRef = useRef(null);
    const glRef = useRef(null);
    const programInfoRef = useRef(null);
    const bufferInfoRef = useRef(null);
    const volumeTextureRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl2');
        
        if (!gl) {
            console.error('WebGL2를 초기화할 수 없습니다.');
            return;
        }

        if (!gl.getExtension('EXT_color_buffer_float')) {
            console.error('EXT_color_buffer_float 확장을 사용할 수 없습니다.');
            return;
        }

        glRef.current = gl;
        const program = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
        
        programInfoRef.current = {
            program: program,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(program, 'aTextureCoord'),
            },
            uniformLocations: {
                viewType: gl.getUniformLocation(program, 'uViewType'),
                sliceOffset: gl.getUniformLocation(program, 'uSliceOffset'),
                volumeTexture: gl.getUniformLocation(program, 'uVolumeTexture')
            },
        };

        initBuffers(gl);

        return () => {
            cleanupWebGL(gl);
        };
    }, []);

    useEffect(() => {
        if (volumeData && glRef.current) {
            updateVolumeTexture(volumeData);
            drawScene();
        }
    }, [volumeData, sliceOffset, viewType]);

    const initBuffers = (gl) => {
        const positions = new Float32Array([
            -1.0,  1.0,
             1.0,  1.0,
            -1.0, -1.0,
             1.0, -1.0,
        ]);

        const texCoords = new Float32Array([
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

        bufferInfoRef.current = {
            position: positionBuffer,
            textureCoord: textureCoordBuffer,
            vertexCount: 4,
        };
    };

    const updateVolumeTexture = (volumeData) => {
        const gl = glRef.current;

        if (volumeTextureRef.current) {
            gl.deleteTexture(volumeTextureRef.current);
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, texture);

        gl.texImage3D(
            gl.TEXTURE_3D,
            0,
            gl.R16F,
            volumeData.width,
            volumeData.height,
            volumeData.depth,
            0,
            gl.RED,
            gl.FLOAT,
            volumeData.data
        );

        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        volumeTextureRef.current = texture;
    };

    const getViewTypeValue = () => {
        switch (viewType) {
            case ViewTypes.SAGITTAL:
                return 1;
            case ViewTypes.CORONAL:
                return 2;
            default:
                return 0; // AXIAL
        }
    };

    const drawScene = () => {
        const gl = glRef.current;
        const programInfo = programInfoRef.current;
        const buffers = bufferInfoRef.current;

        if (!gl || !programInfo || !buffers) return;

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(programInfo.program);

        // Set uniforms
        gl.uniform1f(programInfo.uniformLocations.sliceOffset, sliceOffset);
        gl.uniform1i(programInfo.uniformLocations.viewType, getViewTypeValue());

        // Bind volume texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);

        // Set vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffers.vertexCount);
    };

    const cleanupWebGL = (gl) => {
        if (bufferInfoRef.current) {
            gl.deleteBuffer(bufferInfoRef.current.position);
            gl.deleteBuffer(bufferInfoRef.current.textureCoord);
        }
        if (volumeTextureRef.current) {
            gl.deleteTexture(volumeTextureRef.current);
        }
        if (programInfoRef.current) {
            gl.deleteProgram(programInfoRef.current.program);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            width={512}
            height={512}
            style={{
                border: '2px solid #666',
                background: '#000'
            }}
        />
    );
}

SliceEngine.propTypes = {
    volumeData: PropTypes.shape({
        data: PropTypes.instanceOf(Float32Array),
        width: PropTypes.number,
        height: PropTypes.number,
        depth: PropTypes.number
    }),
    sliceOffset: PropTypes.number,
    viewType: PropTypes.oneOf(Object.values(ViewTypes))
};

export default SliceEngine;
