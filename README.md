# Azure IoT Edge Hub experimental metrics

1. [Create](https://docs.microsoft.com/en-us/azure/azure-monitor/learn/quick-create-workspace#create-a-workspace) an Azure Log Analytics workspace and note its [workspace ID and key](https://docs.microsoft.com/en-us/azure/azure-monitor/platform/agent-windows#obtain-workspace-id-and-key).

1. Use IoT Edge Hub with tag `1.0.9-rc2` and following configuration: 

```json
    "edgeHub": {
      "settings": {
        "image": "mcr.microsoft.com/azureiotedge-hub:1.0.9-rc2",
        "createOptions": "{\"User\":\"ContainerAdministrator\",\"ExposedPorts\":{\"9600/tcp\":{},\"5671/tcp\":{},\"8883/tcp\":{}}}"
      },
      "type": "docker",
      "env": {
        "experimentalfeatures__enabled": {
          "value": true
        },
        "experimentalfeatures__enableMetrics": {
          "value": true
        }
      },
      "status": "running",
      "restartPolicy": "always"
    }
```

>Windows containers need edgeHub to be run a ContainerAdministrator for now if exposing metrics endpoint. Please remove the User key from createOptions on Linux.

1. Add the *metricscollector* module to the deployment:

| Linux amd64 image                    | Windows amd64 image                          |
|--------------------------------------|----------------------------------------------|
| veyalla/metricscollector:0.0.4-amd64 | veyalla/metricscollector:0.0.5-windows-amd64 |




