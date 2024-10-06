import { defineStore } from 'pinia';

export const useTimeStore = defineStore('time', () => {
  const display = (when: number) => {
    const date = new Date(when * 1000);
    let timeStr = new Intl.DateTimeFormat('en-us', {
      hour12: true,
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);
    // Add leading zero to single-digit hours
    if (timeStr.split(':')[0].length === 1) {
      timeStr = '0' + timeStr;
    }

    const now = Math.round(Date.now() / 1000);
    if (now - 24 * 60 * 60 < when) return timeStr;

    const dateParts = date.toDateString().split(' ');
    const dateStr = [
      dateParts[2],
      dateParts[1],
      dateParts[3].split('').slice(2).join(''),
    ].join('/');
    return `${dateStr} · ${timeStr}`;
  };

  return { display };
});
