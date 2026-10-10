import { useCallback } from 'react';
import api from '../../../utils/api';
import { useToast } from '../../../context/ToastContext';

export const EDITOR_OPTIONS = {
  height: 'auto',
  minHeight: '400px',
  placeholder: 'Ketik isi artikel di sini...',
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
    ['removeFormat'],
    ['fontColor', 'hiliteColor'],
    ['outdent', 'indent'],
    ['align', 'horizontalRule', 'list', 'table'],
    ['link', 'image', 'video'],
    ['fullScreen', 'showBlocks', 'codeView'],
    ['preview']
  ],
  // Configuration specifically for youtube/video linking
  videoFileInput: false, // Matikan file upload untuk video, biarkan link saja
  youtubeQuery: 'autoplay=0&rel=0',
};

export const useSunEditor = (onImageUploaded?: (key: string) => void) => {
  const { error: showError } = useToast();

  const handleImageUploadBefore = useCallback((files: any[], info: object, uploadHandler: Function) => {
    const uploadImage = async () => {
      try {
        const results = [];
        
        // 1. Filter awal: Tolak file yang lebih dari 1MB
        const validFiles = [];
        for (const file of files) {
          if (file.size > 1048576) { // 1MB dalam bytes
            showError(`Gambar "${file.name}" ditolak karena ukurannya melebihi batas 1MB. Harap kecilkan ukurannya.`);
            continue;
          }
          validFiles.push(file);
        }

        if (validFiles.length === 0) {
          uploadHandler(); // Batal unggah jika tidak ada file yang valid
          return;
        }

        let hasError = false;

        // 2. Loop untuk mengunggah semua file yang valid secara sekaligus
        for (const file of validFiles) {
          try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/media', formData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            });

            const data = response.data;
            if (data && data.result && data.result.length > 0) {
              // Gunakan absolute URL agar gambar tidak broken jika domain frontend dan backend berbeda
              const baseURL = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api$/, '') : '';
              const absoluteUrl = `${baseURL}${data.result[0].url}`;
              
              const imageResult = { ...data.result[0], url: absoluteUrl };
              results.push(imageResult);
              
              if (onImageUploaded) {
                const match = absoluteUrl.match(/\/api\/media\/([^\/"']+)/);
                if (match) onImageUploaded(match[1]);
              }
            }
          } catch (err) {
            console.error('Upload failed for file:', file.name, err);
            hasError = true;
          }
        }

        if (hasError) {
          showError('Sebagian gambar gagal diunggah. Pastikan format file sesuai dan tidak melampaui limit.');
        }

        if (results.length > 0) {
          uploadHandler({ result: results });
        } else {
          uploadHandler();
        }
      } catch (error) {
        console.error('Critical upload handler failed:', error);
        showError('Gagal memproses unggahan gambar.');
        uploadHandler();
      }
    };
    uploadImage();
    return undefined; 
  }, [showError]);

  return { EDITOR_OPTIONS, handleImageUploadBefore };
};
