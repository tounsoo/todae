import { server } from 'vitest/browser';

// CI's browser tests run in Linux, where todae's sans-serif stack lands on Liberation Sans (ci.yml's "Use a
// sans-serif with a bold face" step). On macOS it lands on SF Pro, whose line box is taller, so a check that
// measures text against a box it sits in, such as EventCalendar's day mark, came out a pixel or two off on a
// Mac only. Arial has Liberation Sans's metrics, which is what Liberation Sans was drawn for, and every Mac has it.
if (server.platform === 'darwin') {
  document.documentElement.style.setProperty('--todae-font-family-sans', 'Arial, sans-serif');
}
