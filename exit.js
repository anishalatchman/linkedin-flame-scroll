/**
 * Exit Page Controller (CSP-compliant, external script)
 */
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('btn-close-zen');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
});
