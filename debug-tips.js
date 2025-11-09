// Debug script to check tips visibility
console.log('Checking tips panel...');

const tipsPanel = document.querySelector('[data-tips]');
console.log('Tips panel element:', tipsPanel);
console.log('Tips panel visible:', tipsPanel ? window.getComputedStyle(tipsPanel).display !== 'none' : false);

const tipsList = document.querySelector('#tipsList');
console.log('Tips list element:', tipsList);
console.log('Tips list content:', tipsList ? tipsList.innerHTML : 'Not found');

// Check localStorage for dismissed tips
const dismissed = localStorage.getItem('animator.tips.dismissed.items');
console.log('Dismissed tips in localStorage:', dismissed);

// Check if all tips are dismissed
if (window.TIPS_CONTENT) {
  console.log('Available tips:', window.TIPS_CONTENT.length);
} else {
  console.log('TIPS_CONTENT not available');
}