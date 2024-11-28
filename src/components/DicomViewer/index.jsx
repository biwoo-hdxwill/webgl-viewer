import { useEffect, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import WebGLViewer from './WebGLViewer';

function DicomViewer() {
    const fileInputRef = useRef(null);
    const viewerRef = useRef(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [loadedImages, setLoadedImages] = useState([]);
    const [currentImageData, setCurrentImageData] = useState(null);

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

            console.log('Loading image:', imageId);
            const image = await cornerstone.loadImage(imageId);
            console.log('Image loaded successfully:', image);
            
            await cornerstone.displayImage(element, image);
            
            cornerstone.setViewport(element, {
                voi: {
                    windowWidth: image.windowWidth || 400,
                    windowCenter: image.windowCenter || 200
                }
            });

            // DICOM 이미지 데이터 추출 및 WebGL용 데이터 생성
            const pixelData = image.getPixelData();
            setCurrentImageData({
                data: new Float32Array(pixelData),
                width: image.width,
                height: image.height,
            });

        } catch (error) {
            console.error('이미지 표시 중 오류:', error);
        }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        console.log('Selected files:', files.length);

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

            console.log('Generated imageIds:', imageIds);
            setLoadedImages(imageIds);
            
            if (imageIds.length > 0) {
                setCurrentImageIndex(0);
                await displayImage(imageIds[0]);
            }
        } catch (error) {
            console.error('파일 처리 중 오류:', error);
        }
    };

    const handlePrevImage = () => {
        setCurrentImageIndex(prev => 
            prev > 0 ? prev - 1 : loadedImages.length - 1
        );
    };

    const handleNextImage = () => {
        setCurrentImageIndex(prev => 
            prev < loadedImages.length - 1 ? prev + 1 : 0
        );
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
                <WebGLViewer imageData={currentImageData} />
            </div>
        </div>
    );
}

export default DicomViewer;
