// src/components/Engine/SliceEngine.jsx
import { useEffect, useRef, useMemo } from 'react';
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
    const renderRequestRef = useRef(null);

    // WebGL 초기화 및 설정을 메모이제이션
    const glSetup = useMemo(() => {
        return {
            positions: new Float32Array([
                -1.0,  1.0,
                 1.0,  1.0,
                -1.0, -1.0,
                 1.0, -1.0,
            ]),
            texCoords: new Float32Array([
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,
                1.0, 1.0,
            ])
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl2', {
            antialias: false,  // 안티앨리어싱 비활성화로 성능 향상
            depth: false,      // depth testing 불필요
            alpha: false       // alpha channel 불필요
        });
        
        if (!gl) {
            console.error('WebGL2를 초기화할 수 없습니다.');
            return;
        }

        gl.getExtension('EXT_color_buffer_float');
        
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
            cancelAnimationFrame(renderRequestRef.current);
            cleanupWebGL(gl);
        };
    }, []);

    useEffect(() => {
        if (volumeData && glRef.current) {
            updateVolumeTexture(volumeData);
        }
    }, [volumeData]);

    useEffect(() => {
        if (glRef.current && programInfoRef.current) {
            renderRequestRef.current = requestAnimationFrame(drawScene);
        }
    }, [sliceOffset, viewType]);

    const initBuffers = (gl) => {
        const { positions, texCoords } = glSetup;

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

        // 텍스처 포맷 최적화
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

        // 텍스처 필터링 최적화
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        volumeTextureRef.current = texture;
    };

    const getViewTypeValue = () => {
        switch (viewType) {
            case ViewTypes.SAGITTAL: return 1;
            case ViewTypes.CORONAL: return 2;
            default: return 0;
        }
    };

    const drawScene = () => {
        const gl = glRef.current;
        const programInfo = programInfoRef.current;
        const buffers = bufferInfoRef.current;

        if (!gl || !programInfo || !buffers) return;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(programInfo.program);
        gl.uniform1f(programInfo.uniformLocations.sliceOffset, sliceOffset);
        gl.uniform1i(programInfo.uniformLocations.viewType, getViewTypeValue());

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTextureRef.current);
        gl.uniform1i(programInfo.uniformLocations.volumeTexture, 0);

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
