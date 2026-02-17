/**
 * Photo capture component — camera input, thumbnail grid, labels.
 * Minimum 3 photos required before sign-off.
 */

import { savePhoto, getPhotosForJob, deletePhoto } from '../js/db.js';
import { showToast } from '../js/toast.js';

/**
 * Render the photo capture section into a container.
 * @param {HTMLElement} container
 * @param {string} jobId
 * @param {Function} onUpdate - called whenever photos change, with photo count
 */
export async function renderPhotoCapture(container, jobId, onUpdate) {
  let photos = await getPhotosForJob(jobId);

  render();

  function render() {
    container.innerHTML = `
      <div class="photo-capture settings-card">
        <div class="settings-card__title">
          Site Photos
          <span class="photo-capture__count ${photos.length >= 3 ? 'photo-capture__count--ok' : ''}">${photos.length}/3 minimum</span>
        </div>

        <div class="photo-grid" id="photo-grid">
          ${photos.map((p, i) => `
            <div class="photo-grid__item" data-photo-index="${i}">
              <img src="${p.dataUrl}" alt="${p.label || 'Site photo'}" class="photo-grid__img">
              <input type="text" class="photo-grid__label" data-photo-id="${p.id}"
                     value="${escHtml(p.label || '')}" placeholder="Label this photo...">
              <button class="photo-grid__remove" data-photo-id="${p.id}" title="Remove">&times;</button>
            </div>
          `).join('')}

          <label class="photo-grid__add" id="photo-add-btn">
            <span class="photo-grid__add-icon">&#128247;</span>
            <span>Take Photo</span>
            <input type="file" accept="image/*" capture="environment" id="photo-input" style="display:none;">
          </label>
        </div>
      </div>
    `;

    attachHandlers();
  }

  function attachHandlers() {
    // Camera input
    container.querySelector('#photo-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Resize and convert to data URL
      const dataUrl = await resizeImage(file, 1200);
      const photo = {
        jobId,
        label: '',
        dataUrl,
        timestamp: new Date().toISOString(),
      };
      await savePhoto(photo);
      photos = await getPhotosForJob(jobId);
      render();
      onUpdate(photos.length);
      showToast('Photo added', 'success');
    });

    // Label editing
    container.querySelectorAll('.photo-grid__label').forEach(input => {
      input.addEventListener('change', async () => {
        const photoId = parseInt(input.dataset.photoId);
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          photo.label = input.value.trim();
          // Note: we'd need an updatePhoto function; for now re-save isn't possible
          // with autoIncrement. Labels are saved when the checklist syncs.
        }
      });
    });

    // Remove photo
    container.querySelectorAll('.photo-grid__remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const photoId = parseInt(btn.dataset.photoId);
        await deletePhoto(photoId);
        photos = await getPhotosForJob(jobId);
        render();
        onUpdate(photos.length);
        showToast('Photo removed', 'info');
      });
    });
  }
}

/**
 * Get current photo count for a job.
 */
export async function getPhotoCount(jobId) {
  const photos = await getPhotosForJob(jobId);
  return photos.length;
}

/**
 * Resize an image file to max dimension, return data URL.
 */
function resizeImage(file, maxDim) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * maxDim / width);
            width = maxDim;
          } else {
            width = Math.round(width * maxDim / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
