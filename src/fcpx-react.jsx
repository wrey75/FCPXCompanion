import React from "react";

const App = () => {
    return (
        <div className="container">
        <h1>FCPX Companion</h1>
  
        <div className="progress" id="scanProgress" style={{display: "none"}}>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label="Scanning files"
            style={{width: "50%"}}
            aria-valuenow="75"
            aria-valuemin="0"
            aria-valuemax="100"
          ></div>
        </div>
  
        <table>
          <tbody>
            <tr>
                <td width="80" height="80">
                <div id="spinner" className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                </td>
                <td>
                <p><span id="scanText">Scanning...</span></p>
                </td>
            </tr>
          </tbody>
        </table>
  
        <div className="row">
          <ul id="tabs" className="nav nav-tabs">
            <li className="nav-item">
              <a id="libraryTab" className="nav-link active" aria-current="page" href="#">Librairies (<span id="lib-badge" >0</span>)</a>
            </li>
            <li className="nav-item">
              <a id="backupTab" className="nav-link" href="#">Backups</a>
            </li>
            <li className="nav-item">
              <a id="fcpxTab" className="nav-link" href="#">FCPX Backups  (<span id="fcpx-badge" >0</span>)</a>
            </li>
            <li className="nav-item">
              <a id="informationTab" className="nav-link" href="#">Informations</a>
            </li>
          </ul>
  
          <ul id="libraryContents" className="list-group" style={{display: "none"}}>
            <li className="list-group-item disabled">
              Aucune librairie découverte...
            </li>
          </ul>
  
          <ul id="backupContents" className="list-group" style={{display: "none"}}>
              <li className="list-group-item disabled">
              To backup your FinalCut libraries, you must have a disk named
              "FCPSlave". Then restart the software to start backup.
              </li>
          </ul>
  
          <div id="fcpxContents" style={{display: "none"}}>
              No FCPX backup detected right now.
          </div>
  
          <div id="informationContents" style={{display: "none"}}>
              <div id="informationData"></div>
              <div id="debug" style={{background: "red", color: "white"}}></div>
          </div>
        </div>
      </div>    
    );
}

export default App