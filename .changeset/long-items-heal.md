---
"@tounsoo/todae": patch
---

New `Coachmark`: `Coachmark.Root` dims the page around one element, which stays usable through a hole in the dim page, makes the rest inert, and points a dialog popup with `Coachmark.Title`, `Coachmark.Description`, `Coachmark.Footer` and `Coachmark.Close` at it; new tokens `coachmark.max-width`, `coachmark.cutout.padding` and `coachmark.motion.*`, whose `move` pair slides the hole and the popup to a tour's next target. The multi-step tour is a new Product tour recipe in the docs.
