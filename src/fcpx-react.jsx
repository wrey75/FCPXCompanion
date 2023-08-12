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
    if (!infos) {
        console.warn("NO DATA AVAILABLE.");
        return (<></>);
    }
    var array = [...Object.values(infos.backupStore)];
    if (array.length == 0) {
        return (<div>No backup found until now...</div>);
    }
    array.sort((a, b) => a.path.localeCompare(b.id));
    return (
        <ul className="list-group">
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
                <nav>
                    <div className="nav nav-tabs" id="nav-tab" role="tablist">
                        <button className="nav-link active" id="nav-library-tab" data-bs-toggle="tab" data-bs-target="#nav-library" type="button" role="tab" aria-controls="nav-library" aria-selected="true">Librairies (<span id="lib-badge" >0</span>)</button>
                        <button className="nav-link" id="nav-backups-tab" data-bs-toggle="tab" data-bs-target="#nav-backups" type="button" role="tab" aria-controls="nav-backups" aria-selected="false">Backups</button>
                        <button className="nav-link" id="nav-autosave-tab" data-bs-toggle="tab" data-bs-target="#nav-autosave" type="button" role="tab" aria-controls="nav-autosauve" aria-selected="false">Auto saved (<span id="fcpx-badge" >0</span>)</button>
                        <button className="nav-link" id="nav-infos-tab" data-bs-toggle="tab" data-bs-target="#nav-infos" type="button" role="tab" aria-controls="nav-infos" aria-selected="false">Informations</button>
                    </div>
                </nav>
                <div className="tab-content" id="nav-tabContent">
                    <div className="tab-pane fade show active" id="nav-library" role="tabpanel" aria-labelledby="nav-library-tab">
                        
                    </div>

                   <div className="tab-pane fade" id="nav-backups" role="tabpanel" aria-labelledby="nav-backups-tab">
                        <BackupContents infos={status}></BackupContents>
                   </div>
                    

                    <div className="tab-pane fade" id="nav-infos" role="tabpanel" aria-labelledby="nav-infos-tab">
                        <InformationData props={status}></InformationData>
                        <DebugInfo data={status} ></DebugInfo>
                    </div>

                    <div className="tab-pane fade" id="nav-autosave" role="tabpanel" aria-labelledby="nav-autosave-tab">
                        No FCPX backup detected right now.
                    </div>

                 
                </div>
            </div>
        </div>
    );
}

export default App;