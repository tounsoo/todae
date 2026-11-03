---
"@tounsoo/todae": patch
---

BottomSheet now runs on the same modal shell as Dialog and Drawer, every close part (Dialog, Drawer and BottomSheet Close, Toast.Close, Alert.Close and Attachment.Remove) renders one shared close button, and a Dialog, Drawer or BottomSheet Title, Description or Close outside its Root throws one message that names all three.
