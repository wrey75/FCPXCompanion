import React from "react";

const DebugInfo = ({ data }) => {
    return (
        <div style={{ background: "red", color: "white" }}>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    )
}

const SimpleBackup = ({ id, path, first, last, updated, lost }) => {
    return (
        <li className="list-group-item" key={id}>
            <small><code>{id}</code></small><br />
            <small>{path}</small><br />
            <small>First scan: {new Date(first).toLocaleDateString()}
                {last ? (<React.Fragment> Last seen: {new Date(last).toLocaleDateString()}</React.Fragment>) : ''}
                {updated ? (<React.Fragment>, Last backup: {new Date(updated).toLocaleDateString()}</React.Fragment>) : ''}
            </small><br />
            {lost > 0 ? (<React.Fragment><span className="text-danger"><strong>Missing {lost} files</strong></span><br /></React.Fragment>) : ''}
        </li>
    );
}

const BackupContents = ({ infos }) => {
    if(!infos){
        console.warn("NO DATA AVAILABLE.");
        return (<></>);
    }
    var array = [...Object.values(infos.backupStore)];
    if (array.length == 0) {
        return (<div>No backup found until now...</div>);
    }
    array.sort((a, b) => a.path.localeCompare(b.id));
    return (
        <ul id="backupContents" className="list-group" style={{ display: "none" }}>
            {array.map((x) => <SimpleBackup id={x.id} path={x.path} first={x.first} last={x.last} updated={x.last} lost={x.lost} />)}
        </ul>
    )
}

const InformationData = ({ props }) => {
    if (!props) {
        console.warn("DATA NOT YET AVAILABLE");
        return (<div></div>)
    } else {
        {
            var backupInfo = (<></>);
            if (props.backup) {
                backupInfo = (<React.Fragment>
                    <tr><td>Backup Storage:</td><td>{props.backup.directory}</td></tr>
                    <tr><td>Files backuped:</td><td>{props.backup.done}</td></tr>
                    <tr><td>Files to backup:</td><td>{props.backup.total}</td></tr>
                </React.Fragment>);
            }
        }
        return (
            <table>
                <tbody>
                    <tr><td>Scanned directories:</td><td>{props.scannedDirectories}</td></tr>
                    <tr><td>Total of directories:</td><td>{props.totalDirectories}</td></tr>
                    <tr><td>Registered files:</td><td>{props.filesInMap}</td></tr>
                    {backupInfo}
                </tbody>
            </table>
        );
    }
}

const App = ({ status }) => {
    // if(!status){
    //     return (<div>Initialising...</div>);
    // }
    return (
        <div className="container">
            <h1>FCPX Companion</h1>

            <div className="progress" id="scanProgress" style={{ display: "none" }}>
                <div
                    className="progress-bar"
                    role="progressbar"
                    aria-label="Scanning files"
                    style={{ width: "50%" }}
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

                <ul id="libraryContents" className="list-group" style={{ display: "none" }}>
                    <li className="list-group-item disabled">
                        Aucune librairie découverte...
                    </li>
                </ul>

                <BackupContents infos={status}></BackupContents>
                <ul id="backupContents" className="list-group" style={{ display: "none" }}>
                    <li className="list-group-item disabled">
                        To backup your FinalCut libraries, you must have a disk named
                        "FCPSlave". Then restart the software to start backup.
                    </li>
                </ul>

                <div id="fcpxContents" style={{ display: "none" }}>
                    No FCPX backup detected right now.
                </div>

                <div id="informationContents" style={{ display: "none" }}>
                    <InformationData props={status}></InformationData>
                    <DebugInfo data={status} ></DebugInfo>
                </div>
            </div>
        </div>
    );
}

export default App;