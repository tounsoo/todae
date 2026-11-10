---
"@tounsoo/todae": patch
---

Button.Root now mounts its tooltip only when one can show, the first time the pointer or keys reach an icon-only button or find a label cut, so a Button the person never reaches holds no tooltip state; its tip is hidden from screen readers and no longer joins aria-describedby, so the name is read once.
