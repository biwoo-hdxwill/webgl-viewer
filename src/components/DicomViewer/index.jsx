// src/components/DicomViewer/index.jsx
import { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import WebGLViewer, { ViewTypes } from './WebGLViewer';

function DicomViewer() {
    const fileInputRef = useRef(null);
    const viewerRef = useRef(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [loadedImages, setLoadedImages] = useState([]);
    const [volumeData, setVolumeData] = useState(null);
    const [axialOffset, setAxialOffset] = useState(0.5);
    const [sagittalOffset, setSagittalOffset] = useState(0.5);
    const [coronalOffset, setCoronalOffset] = useState(0.5);

    useEffect(() => {
        const initializeCornerstone = async () => {
            try {
                cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
                cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
                
                cornerstoneWADOImageLoader.configure({
                    beforeSend: function(xhr) {
                        xhr.setRequestHeader('Content-Type', 'application/dicom');
                    }
                });

                cornerstoneWADOImageLoader.webWorkerManager.initialize({
                    maxWebWorkers: navigator.hardwareConcurrency || 1,
                    startWebWorkersOnDemand: true,
                    taskConfiguration: {
                        decodeTask: {
                            loadCodecsOnStartup: true,
                            initializeCodecsOnStartup: false
                        }
                    }
                });

                if (viewerRef.current) {
                    cornerstone.enable(viewerRef.current);
                }
            } catch (error) {
                console.error('Cornerstone 초기화 중 오류:', error);
            }
        };

        initializeCornerstone();

        return () => {
            if (viewerRef.current) {
                cornerstone.disable(viewerRef.current);
            }
        };
    }, []);

    const displayImage = async (imageId) => {
        try {
            const element = viewerRef.current;
            if (!element) return;

            const image = await cornerstone.loadImage(imageId);
            await cornerstone.displayImage(element, image);
            
            cornerstone.setViewport(element, {
                voi: {
                    windowWidth: image.windowWidth || 400,
                    windowCenter: image.windowCenter || 200
                }
            });

        } catch (error) {
            console.error('이미지 표시 중 오류:', error);
        }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        const dicomFiles = files.filter(file => 
            file.name.toLowerCase().endsWith('.dcm') || 
            file.type === 'application/dicom'
        );

        try {
            const imageIds = await Promise.all(dicomFiles.map(file => {
                return new Promise((resolve) => {
                    const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
                    resolve(imageId);
                });
            }));

            setLoadedImages(imageIds);
            
            // 모든 이미지의 픽셀 데이터를 로드
            const images = await Promise.all(imageIds.map(id => cornerstone.loadImage(id)));
            const firstImage = images[0];

            // 볼륨 데이터 구성
            const volumeBuffer = new Float32Array(firstImage.width * firstImage.height * images.length);
            
            // 각 슬라이스의 데이터를 볼륨에 복사
            images.forEach((image, i) => {
                const pixelData = image.getPixelData();
                const offset = i * firstImage.width * firstImage.height;
                
                for (let j = 0; j < pixelData.length; j++) {
                    volumeBuffer[offset + j] = pixelData[j] / 255.0; // 정규화
                }
            });

            setVolumeData({
                data: volumeBuffer,
                width: firstImage.width,
                height: firstImage.height,
                depth: images.length
            });

            if (imageIds.length > 0) {
                setCurrentImageIndex(0);
                await displayImage(imageIds[0]);
            }
        } catch (error) {
            console.error('파일 처리 중 오류:', error);
        }
    };

    const handlePrevImage = () => {
        setCurrentImageIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : loadedImages.length - 1;
            //etAxialOffset(newIndex / (loadedImages.length - 1));
            //setSagittalOffset(newIndex / (loadedImages.length - 1));
            //setCoronalOffset(newIndex / (loadedImages.length - 1));
            return newIndex;
        });
    };

    const handleNextImage = () => {
        setCurrentImageIndex(prev => {
            const newIndex = prev < loadedImages.length - 1 ? prev + 1 : 0;
            //setAxialOffset(newIndex / (loadedImages.length - 1));
            //setSagittalOffset(newIndex / (loadedImages.length - 1));
            //setCoronalOffset(newIndex / (loadedImages.length - 1));
            return newIndex;
        });
    };

    useEffect(() => {
        if (loadedImages.length > 0) {
            displayImage(loadedImages[currentImageIndex]);
        }
    }, [currentImageIndex, loadedImages]);

    return (
        <div className="app" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    webkitdirectory=""
                    directory=""
                    multiple
                    style={{ marginRight: '10px' }}
                />
                <div style={{ marginTop: '10px' }}>
                    <button 
                        onClick={handlePrevImage}
                        disabled={loadedImages.length === 0}
                        style={{ marginRight: '10px' }}
                    >
                        이전 이미지
                    </button>
                    <button 
                        onClick={handleNextImage}
                        disabled={loadedImages.length === 0}
                    >
                        다음 이미지
                    </button>
                    {loadedImages.length > 0 && (
                        <span style={{ marginLeft: '10px' }}>
                            {currentImageIndex + 1} / {loadedImages.length}
                        </span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <div
                        ref={viewerRef}
                        style={{
                            width: '512px',
                            height: '512px',
                            border: '2px solid #666',
                            background: '#000',
                            color: 'white'
                        }}
                    />
                    <WebGLViewer 
                        volumeData={volumeData} 
                        sliceOffset={axialOffset} 
                        viewType={ViewTypes.AXIAL}
                    />
                </div>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <WebGLViewer 
                        volumeData={volumeData} 
                        sliceOffset={sagittalOffset} 
                        viewType={ViewTypes.SAGITTAL}
                    />
                    <WebGLViewer 
                        volumeData={volumeData} 
                        sliceOffset={coronalOffset} 
                        viewType={ViewTypes.CORONAL}
                    />
                </div>
            </div>
        </div>
    );
}

export default DicomViewer;
