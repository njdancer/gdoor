var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var child_process = require("child_process");
var debug = require('debug')('GarageDoor');
var uuid = require('../').uuid;
var util = require("util");

var accessoryName = "Garage Door";
var deviceMacAddress = "dc:44:6d:6d:6f:d8"
var doorManufacturer = "Chamberlain";
var doorModel = "Merlin Professional MT60P";
var doorSerialNumber = deviceMacAddress
var doorStatusCommand = "/home/hapadmin/gdoor/door-status";
// must be of format ddd-dd-ddd - pick something random
var pairingCode = "582-73-289";

var GARAGE = {
  updateDoorStatus: function(topSensorValue, bottomSensorValue) {
    var debug = require('debug')('GarageDoor:SensorValues');

    var gdo = garage.getService(Service.GarageDoorOpener);
    if (topSensorValue === 1 && bottomSensorValue === 0) {
      // top sensor open(HIGH) and bottom sensor closed(LOW) = door down
      GARAGE.status = GARAGE.lastRestingStatus = Characteristic.CurrentDoorState.CLOSED;
      debug("Door has closed - top sensor open(HIGH), bottom sensor closed(LOW)");
      gdo.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
    } else if (topSensorValue === 0 && bottomSensorValue === 1) {
      // top sensor closed(LOW) and bottom sensor open(HIGH) = door up
      GARAGE.status = GARAGE.lastRestingStatus = Characteristic.CurrentDoorState.OPEN;
      debug("Door has opened - top sensor closed(LOW), bottom sensor open(HIGH)");
      gdo.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
    } else if (topSensorValue === 1 && bottomSensorValue === 1) {
      // both sensors open(HIGH) = door in between positions
      if (GARAGE.lastRestingStatus === Characteristic.CurrentDoorState.CLOSED) {
        GARAGE.status = Characteristic.CurrentDoorState.OPENING;
        debug("Door is opening - both sensors open(HIGH), last resting status was closed");
        gdo.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
      } else if (GARAGE.lastRestingStatus === Characteristic.CurrentDoorState.OPEN) {
        GARAGE.status = Characteristic.CurrentDoorState.CLOSING;
        debug("Door is opening - both sensors open(HIGH), last resting status was open");
        gdo.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED );
      } else {
        debug("Door status unknown - both sensors open(HIGH) but last resting status is unknown")
        return;
      }
    } else {
      // both sensors closed(LOW) - this should not be possible, door cannot be in both states
      debug("Door status unknown - both sensors closed(HIGH), possible hardware error");
      return
    }

    // push door status update to HAP
    // TODO: find a better spot for this
    garage.getService(Service.GarageDoorOpener)
          .setCharacteristic(Characteristic.CurrentDoorState, GARAGE.status);
  },
  switch: function(times, callback) {
    var cb = typeof times === 'function' ? times : callback
    // delay between switches in ms
    var switchDelay = 2000;

    child_process.execSync("~/gdoor/switch-door");
    if (times !== undefined && typeof times !== 'function' && times > 1) {
      setTimeout(function() {
        GARAGE.switch(times - 1);
      }, switchDelay);
    } else if (typeof cb === 'function') {
      cb();
    }
  },
  setDoorStatus: function(targetStatus, callback) {
    var debug = require('debug')('GarageDoor:DoorSwitch');

    // configure values for later use or return from function
    var newStatus;
    var activeNewStatus;
    var antiNewStatus;
    var antiActiveNewStatus;
    var stoppedStatusString;
    var activeStatusString;
    switch (targetStatus) {
      case Characteristic.TargetDoorState.OPEN:
        newStatus = Characteristic.CurrentDoorState.OPEN
        activeNewStatus = Characteristic.CurrentDoorState.OPENING
        antiNewStatus = Characteristic.CurrentDoorState.CLOSED
        antiActiveNewStatus = Characteristic.CurrentDoorState.CLOSING
        stoppedStatusString = "open"
        activeStatusString = "opening"
        break;
      case Characteristic.TargetDoorState.CLOSED:
        newStatus = Characteristic.CurrentDoorState.CLOSED
        activeNewStatus = Characteristic.CurrentDoorState.CLOSING
        antiNewStatus = Characteristic.CurrentDoorState.OPEN
        antiActiveNewStatus = Characteristic.CurrentDoorState.OPENING
        stoppedStatusString = "closed"
        activeStatusString = "closing"
        break;
      default:
        debug("Invalid newStatus passed to setDoorStatus - this is likely a programming error");
        return;
    }
    var activeStatusStringUc = activeStatusString.charAt(0).toUpperCase() + activeStatusString.slice(1)

    // trigger garage door switch depending on current status
    switch (GARAGE.status) {
      case newStatus:
        debug(`Garage already ${stoppedStatusString}`);
        callback();
        break;
      case activeNewStatus:
        debug(`Garage already ${activeStatusString}`);
        callback();
        break;
      case antiNewStatus:
        debug(`${activeStatusStringUc} the garage`);
        GARAGE.switch(callback);
        break;
      case antiActiveNewStatus:
        debug(`${activeStatusStringUc} the garage`);
        // if already moving switch will need to be triggered twice to stop and reverse
        GARAGE.switch(2, callback);
        break;
      case Characteristic.CurrentDoorState.STOPPED:
        debug("Door stopped - moving in unknown direction");
        GARAGE.switch(callback);
        break;
      default:
        debug("Unknown door state - bailing for safety and security");
        debug("This is likely a hardware error(switch position) or door has been stopped midway and gdoor reset");
        debug("If the latter is true try manually triggering the switch");
        callback();
        break;
    }
  },
  // open: function() {
  //   GARAGE.setDoorStatus(Characteristic.CurrentDoorState.OPEN);
  // },
  // close: function() {
  //   GARAGE.setDoorStatus(Characteristic.CurrentDoorState.CLOSED);
  // },
  identify: function(callback) {
    debug("Identifying...");
    child_process.exec("~/gdoor/identify", function(err, data) {
      if (err) {
        debug(`Identify - Error: ${err}`);
        callback();
        return;
      }
      if (data !== "\n" && data !== "") {
        debug(`Identify: ${util.inspect(data)}`);
      }
      callback();
      return;
    });
  }
};

// Monitor door status by running door-status in watch mode
var doorStatus = child_process.spawn(doorStatusCommand, ["-w"]);
doorStatus.stdout.on('data', function(data) {
  if (data === "\n" || data === "") {
    // ignore empty lines
    return
  }

  // Switch values have changed, process current values
  var regex = /TOP (\d) BOTTOM (\d)/;
  var doorSwitchValues = regex.exec(data);
  if (doorSwitchValues.length !== 3) {
    debug(`Invalid response from door-status: ${data}`);
    return;
  }

  var topSensorValue = Number(doorSwitchValues[1]);
  var bottomSensorValue = Number(doorSwitchValues[2]);

  GARAGE.updateDoorStatus(topSensorValue, bottomSensorValue);
});
doorStatus.stderr.on('data', function(data) {
  var debug = require('debug')('GarageDoor:SensorValues');
  debug("Error running door-status - %s", data);
});

var garageUUID = uuid.generate('hap-nodejs:accessories:'+accessoryName);
var garage = exports.accessory = new Accessory(accessoryName, garageUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
garage.username = deviceMacAddress; //edit this if you use Core.js
garage.pincode = pairingCode;

garage
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, doorManufacturer)
  .setCharacteristic(Characteristic.Model, doorModel)
  .setCharacteristic(Characteristic.SerialNumber, doorSerialNumber);

garage.on('identify', function(paired, callback) {
  GARAGE.identify(callback);
});

garage
  .addService(Service.GarageDoorOpener, "Garage Door")
  .getCharacteristic(Characteristic.TargetDoorState)
  .on('set', function(targetState, callback) {
    console.log(targetState);
    console.log(typeof callback);
    if (targetState === Characteristic.TargetDoorState.CLOSED &&
        GARAGE.status === Characteristic.CurrentDoorState.CLOSED) {
      return
      console.log("both closed");
    }
    if (targetState === Characteristic.TargetDoorState.OPEN &&
        GARAGE.status === Characteristic.CurrentDoorState.OPEN) {
      return
      console.log("both open");
    }

    GARAGE.setDoorStatus(targetState, callback);
    callback()
    // if (value == Characteristic.TargetDoorState.CLOSED) {
    //   GARAGE.close();
    //   callback();
    // } else if (value == Characteristic.TargetDoorState.OPEN) {
    //   GARAGE.open();
    //   callback();
    // }
  });

// garage
//   .getService(Service.GarageDoorOpener)
//   .setCharacteristic(Characteristic.TargetDoorState,
//     GARAGE.status === Characteristic.CurrentDoorState.CLOSED
//       ? Characteristic.TargetDoorState.CLOSED
//       : Characteristic.TargetDoorState.OPEN)

garage
  .getService(Service.GarageDoorOpener)
  .getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', function(callback) {
    if (GARAGE.status !== Characteristic.CurrentDoorState.OPEN &&
        GARAGE.status !== Characteristic.CurrentDoorState.CLOSED &&
        GARAGE.status !== Characteristic.CurrentDoorState.OPENING &&
        GARAGE.status !== Characteristic.CurrentDoorState.CLOSING &&
        GARAGE.status !== Characteristic.CurrentDoorState.STOPPED) {
      callback("Garage status incorrectly set");
      return;
    }
    callback(null, GARAGE.status);
    return;
  });
