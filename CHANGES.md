CHANGES
=======

Beta release
------------

* Backup in the `FCPBackup` disk.
* Control of duplicate libraries
* Use of `store.json` for storage of library information.
* Saves the linked files in `Folders` directory of the `BackupStore`.
* Display of lost links.

v0.20.0
-------

* feat: Added the version in the title of the window
* feat: Added a progress when copying files

v0.21.0
-------

* feat: No more indexing for the `BackupStore`
* feat: backup store goes to version 1.

v0.22.0
-------

* feat: Libraries are stored by names in the `Libraries` store.
* feat: All media files are also saved in the `Folders` store.
* feat: backup store goes to version 2.

v0.25.0
-------

* feat(duplicates): duplicates are now grouped rather than added at the end of the list.
* feat(duplicates): do not display the library ID for duplicates.
* feat(duplicates): the red background for duplicates have been faded to improve the lisibility.
* feat: do not round anymore the file sizes.
* feat: the media is now split in 2 parts: the _files_ (stored in the library itself) and  _linked_  files (stored outside the library).

v0.30.0
-------

* feat: copy  directories using hard links for files bigger than 2KB.
* fix(backup): Copy the `Motion Templates` directory of the library.
* feat(backup): the internal files (stored in `Original Media`) are no longer saved into the `Folders` directory avoiding the creation of a _fake_ library.

v0.50.0
-------

* feat: Paths are abreviated if they exceed a specific length.
* feat: better display of objects especially in special cases.
* feat: added the "FCPX backups" list.
* fix: when the backup can start _before_ the FCPBackup disk has been found.
* fix: can copy source directories with ".localized" extnsion (but without the extension).

v0.60.0
-------

* refactor: integration of React for optimization (includes WebPack).
* refactor: code is not changed and React not used.
* fix: a direct usage of 'fcpxLibraries' in the function "refreshDisplay()"
* fix: plain JS errors reported by Webpack.
* NOTE: this version does not include any enhancements but is a rewrite to use React in the next version.
* refactor: removed jQuery usage in `fcpx-renderer.js`

v0.80.0
-------

A complete refactoring using React.

* v0.80.0: moved "index.html" to "fcpx-react.jsx" using React &lt;App&gt; component.
* v0.80.1: refactored "informationData" with passing the information though &lt;App&gt;.
* v0.80.2: refactored "backupContents"
* v0.80.3: refactored tab changes to remove jQuery use replaced by Bootrap 5 implementation.
* v0.80.4: fixed missing key for list of backups.
* v0.80.5: refactored "libraryContents" (and moved some stuff).
* v0.80.5: added the bootstrap icons directly via "react-bootstrap-icons".
* v0.80.6: refactored "auto saved" FCPX libraries.

v0.82.0
-------

* refactor: complete remove of jQuery.
* refactor: remove of fcpx-gui.
* refactor: now on electron forge + webpack
* bug: when scan is done, no stop if the disk of backup is missing.
* bug: no JS for switching the tabs.

v0.83.0
-------

* refactor: added bootstrap for react
* fix: correct message when scan or backup is done.
* fix: now tabs uses the react &lg;Tab&gt; tag from React
* feat: closing the window closes the application (as for FCPX...) which is not the way MacOS works.
* fix: the version of the software is now displayed in the title bar.
* feat: the console tool does appear only in debug mode.

v0.85.0
-------

* fix: display of lost files (React issue).
* fix: opening the FCPX library via the button will not scroll up the screen anymore.
* fix: in the tab "Backups", data could be totally incorrect under some circumstances.
* feat: the backup store file is saved once modified (when a library is added to the backup list).
* fix: when a library is moved, then the backup store reflect silently the change.

v0.90.0
-------

* fix: issue displaying libraries as duplicated if already backuped.
* feat: keep the power up during the running of the software.
* refactor: use of &lt;Spinner&gt; from React Bootstrap.

v0.95.0
-------

* feat: the scan of the libraries and their backup is now sequential (esier for the end user).
* fix: issue in saving the store.json
* refactor: the way the refresh function works. Now the fcpx-renderer code is responsible for synchronisation.
* refactor: the scan is now fully asynchronously and made _before_ the scan of each library.
* refactor: the async/Promises are now well understood and well integrated.
* feat: added a logo for the application in the main screen and reorganized display
* feat: if the backup disk is not inserted, the display shows an alert and the backup tab is hidden.
 