function main(params) {
  AWS = require('aws-sdk');

  if (!params.secrets || !params.secrets.awsCostExplorerAccessKeyId || !params.secrets.awsCostExplorerSecretAccessKeyId ||
    !params.secrets.awsCostExporerRegion == null) {
    return { text: "You must create secrets for awsCostExplorerAccessKeyId, awsCostExplorerSecretAccessKeyId " +
      "and awsCostExporerRegion to use this command " };
  }

  var costexplorer = new AWS.CostExplorer({
    accessKeyId: params.secrets.awsCostExplorerAccessKeyId,
    secretAccessKey: params.secrets.awsCostExplorerSecretAccessKeyId,
    region: params.secrets.awsCostExplorerRegion
  });
  
  // determine billing period start/end. toISOString() is UTC (GMT) time, which is what AWS bills in
  let now = new Date();
  let firstOfThisMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
  let firstOfNextMonth;
  if (now.getMonth() != 12) {
    firstOfNextMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  } else {
    firstOfNextMonth = new Date(now.getUTCFullYear() + 1, 1, 1);
  }
  let start = firstOfThisMonth.toISOString().substring(0, 10);
  let end = firstOfNextMonth.toISOString().substring(0, 10);

  var params = {
    "TimePeriod" : {
      "Start" : start,
      "End" : end,
    },
    "Granularity" : "MONTHLY",
    "GroupBy" : [ { Key: "SERVICE", Type: "DIMENSION" } ],
    "Metrics" : ["AmortizedCost"]
  }

  return costexplorer.getCostAndUsage(params).promise().then(
    function(data) {

      // for debugging:
      // console.log(JSON.stringify(data, null, 4));

      let byServiceString = "";
      let groups = data["ResultsByTime"][0]["Groups"];
      let totalCost = 0.0;
      let unit;
      let hasMultipleUnits = 0;
      let i, n = 0;
      for (i = 0; i < groups.length; i++) {
        let cost = groups[i]["Metrics"]["AmortizedCost"]["Amount"];
        if (cost == 0 ) {
          continue;
        }
        cost = parseFloat(cost);

        // make the service names shorter
        let serviceName =  groups[i]["Keys"][0];
        serviceName = serviceName.replace("Amazon ", "");
        serviceName = serviceName.replace("Amazon", "");
        serviceName = serviceName.replace("AWS", "");

        totalCost += cost;
        let thisUnit  = groups[i]["Metrics"]["AmortizedCost"]["Unit"];
        if (thisUnit == "USD") {
          costInUnits = "$" + cost.toFixed(2);
        } else {
          costInUnits = cost.toFixed(2) + " " + thisUnit;
        }
        if (n > 0) {
          byServiceString += ", ";
        }
        byServiceString += serviceName + " " + costInUnits;
        if (unit != null && unit != thisUnit) {
          hasMultipleUnits = 1;
        }
        unit = thisUnit;
        n++;
      }

      totalCostString = totalCost.toFixed(2);
      if (hasMultipleUnits) {
        totalCostString += " (costs in in multiple units)";
      } else {
        if (unit == "USD") {
          totalCostString = "$" + totalCostString;
        } else {
          totalCostString += " " + unit;
        }
      }

      // for debugging:
      // console.log("Month-to-date AWS charges: " + totalCostString);
      // console.log("Charges by service: " + byServiceString);

      return body: {  response_type: 'in_channel', text: "Month-to-date AWS charges: " + totalCostString + "\n\nCharges by service: " + byServiceString };
    },
    function(error) {
      // console.log(err);
      return {  response_type: 'in_channel', text: "Error: " + err  + " AWS version: " + AWS.VERSION};
    }
  );
}
