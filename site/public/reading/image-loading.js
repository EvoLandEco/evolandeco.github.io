(() => {
  for (const image of document.images) {
    if (image.complete) {
      delete image.dataset.imageLoading;
      continue;
    }
    image.dataset.imageLoading = 'true';
    const finish = () => {
      delete image.dataset.imageLoading;
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
    };
    image.addEventListener('load', finish);
    image.addEventListener('error', finish);
  }
})();
