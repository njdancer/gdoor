/* IMPORTS */

var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var CurrentDoorState = Characteristic.CurrentDoorState;
var TargetDoorState = Characteristic.TargetDoorState;
var child_process = require("child_process");
var debug = require('debug')('GDoor');
var uuid = require('../').uuid;
var util = require("util");

/* CONFIG */

var accessoryName = "GDoor";
var deviceMacAddress = "dc:44:6d:6d:6f:d8"
var doorManufacturer = "Chamberlain";
var doorModel = "Merlin Professional MT60P";
var doorSerialNumber = deviceMacAddress
// must be of format ddd-dd-ddd - pick something random
var pairingCode = "582-73-289";

/* STATE */

var currentDoorState;
var lastRestingDoorState;

/* GPIO FUNCTIONS */

var gpioDebug = require('debug')('GDoor-GPIO');

var switchDoor = function switchDoor(times, callback) {
  // correct parameters in case only callback has been specified
  if (typeof times === 'function') { callback = times; times = 1; }

  // delay between switches in ms
  var switchDelay = 2000;

  gpioDebug("Switching door");
  child_process.exec("/usr/local/bin/switch-door", function (err, data) {
    if (err) {
      // If command returns error bail out
      gpioDebug(`Error switching door: ${err}`);
      callback(err);
      return;
    }

    if (data !== "\n" && data !== "") {
      // Log any response that isn't an empty line
      gpioDebug(`switch-door: ${util.inspect(data)}`);
    }

    if (times !== undefined && typeof times !== 'function' && times > 1) {
      // Recurse through function if multiple times specified
      setTimeout(function() {
        switchDoor(times - 1, callback);
      }, switchDelay);
    } else if (typeof callback === 'function') {
      callback(err, data);
    }
  });
}

var doorStatus = function doorStatus(callback) {
  gpioDebug("Monitoring door status");
  // Start long running process to watch door sensors
  var process = child_process.spawn("/usr/local/bin/door-status",["-w"]);

  process.stdout.on('data', function(data) {
    if (data === "\n" || data === "") {
      // Ignore empty lines
      return;
    }

    // Switch values have changed, process current values
    var regex = /TOP (\d) BOTTOM (\d)/;
    var doorSwitchValues = regex.exec(data);
    if (doorSwitchValues.length !== 3) {
      gpioDebug(`Invalid response from door-status: ${data}`);
      return;
    }

    var doorState = {
      top: Number(doorSwitchValues[1]),
      bottom: Number(doorSwitchValues[2])
    };

    gpioDebug(`Sensor's updated to: ${util.inspect(doorState)}`)
    callback(null, doorState);
  });
  process.stderr.on('data', function(err) {
    gpioDebug(`Error running door-status: ${err}`);
    callback(err);
  });
}

var identify = function identify(callback) {
  gpioDebug("Identifying");
  child_process.exec("/usr/local/bin/identify", function(err, data) {
    if (err) {
      // If command returns error bail out
      gpioDebug(`Error identifying: ${err}`);
      callback(err);
      return;
    }

    if (data !== "\n" && data !== "") {
      // Log any response that isn't an empty line
      gpioDebug(`identify: ${util.inspect(data)}`);
    }

    callback(err, data);
  });
}

/* HAP SETUP */

// Create GDoor accessory and provide basic information
var garageUUID = uuid.generate('hap-nodejs:accessories:'+accessoryName);
var gdoor = exports.accessory = new Accessory(accessoryName, garageUUID);

// The following are only required when running Core.js
gdoor.username = deviceMacAddress;
gdoor.pincode = pairingCode;

gdoor
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, doorManufacturer)
  .setCharacteristic(Characteristic.Model, doorModel)
  .setCharacteristic(Characteristic.SerialNumber, doorSerialNumber);

// Create garage door service under GDoor
var gdo = gdoor.addService(Service.GarageDoorOpener, "Garage Door")

/* HAP ACTIONS */

gdoor.on('identify', function(paired, callback) {
  GARAGE.identify(callback);
});

gdo.getCharacteristic(TargetDoorState)
  .on('set', function(targetState, callback) {
    // configure values for later use or return from function
    var newState;
    var activeNewState;
    var antiNewState;
    var antiActiveNewState;
    var stoppedStateString;
    var activeStateString;
    switch (targetState) {
      case Characteristic.TargetDoorState.OPEN:
        newState = Characteristic.CurrentDoorState.OPEN
        activeNewState = Characteristic.CurrentDoorState.OPENING
        antiNewState = Characteristic.CurrentDoorState.CLOSED
        antiActiveNewState = Characteristic.CurrentDoorState.CLOSING
        stoppedStateString = "open"
        activeStateString = "opening"
        break;
      case Characteristic.TargetDoorState.CLOSED:
        newState = Characteristic.CurrentDoorState.CLOSED
        activeNewState = Characteristic.CurrentDoorState.CLOSING
        antiNewState = Characteristic.CurrentDoorState.OPEN
        antiActiveNewState = Characteristic.CurrentDoorState.OPENING
        stoppedStateString = "closed"
        activeStateString = "closing"
        break;
      default:
        debug("Invalid newState passed to setDoorState - this is likely a programming error");
        callback()
        return;
    }
    var activeStateStringUc = activeStateString.charAt(0).toUpperCase() + activeStateString.slice(1)

    // trigger garage door switch depending on current status
    switch (currentDoorState) {
      case newState:
        callback();
        break;
      case activeNewState:
        callback();
        break;
      case antiNewState:
        debug(`${activeStateStringUc} the garage`);
        switchDoor(callback);
        break;
      case antiActiveNewState:
        debug(`${activeStateStringUc} the garage - needs reversing`);
        // if already moving, switch will need to be triggered twice to stop and reverse
        switchDoor(2, callback);
        break;
      case CurrentDoorState.STOPPED:
        debug("Door currently stopped - will start moving in unknown direction");
        switchDoor(callback);
        break;
      default:
        debug("Unknown door state - bailing for safety and security");
        debug("This is likely a hardware error(switch position) or door has been stopped midway and gdoor reset");
        debug("If the latter is true try manually triggering the switch");
        callback();
        break;
    }
  });

/* MONITOR */

// create variable to store timer ID for stop tracking
var movementTimer;
doorStatus(function(err, sensors) {
  if (err) {
    debug(`Error updating door status: ${err}`);
  }

  if (sensors.top === 1 && sensors.bottom === 0) {
    // top sensor open(HIGH) and bottom sensor closed(LOW) = door down
    currentDoorState = lastRestingDoorState = CurrentDoorState.CLOSED;
    debug("Door is closed");

    // Door has reached final position so movement timer can be stopped
    if (movementTimer !== null) {
      clearTimeout(movementTimer);
      movementTimer = null;
    }
  } else if (sensors.top === 0 && sensors.bottom === 1) {
    // top sensor closed(LOW) and bottom sensor open(HIGH) = door up
    currentDoorState = lastRestingDoorState = CurrentDoorState.OPEN;
    debug("Door is open");

    // Door has reached final position so movement timer can be stopped
    if (movementTimer !== null) {
      clearTimeout(movementTimer);
      movementTimer = null;
    }
  } else if (sensors.top === 1 && sensors.bottom === 1) {
    // both sensors open(HIGH) = door in between positions

    if (movementTimer !== null) {
      clearTimeout(movementTimer);
    }
    movementTimer = setTimeout(function() {
      currentDoorState = CurrentDoorState.STOPPED
      gdo.setCharacteristic(CurrentDoorState, currentDoorState);
      debug("Door has stopped");
    }, 22000);

    if (lastRestingDoorState === CurrentDoorState.CLOSED) {
      currentDoorState = CurrentDoorState.OPENING
      debug("Door is opening");
    } else if (lastRestingDoorState === CurrentDoorState.OPEN) {
      currentDoorState = CurrentDoorState.CLOSING
      debug("Door is closing");
    } else {
      debug("Door status unknown - door moving in unknown direction");
      return;
    }
  } else {
    // both sensors closed(LOW) - this should not be possible, door cannot be in both states
    debug("Door status unknown - possible hardware error");
    return
  }

  gdo.setCharacteristic(CurrentDoorState, currentDoorState);
  if (currentDoorState === CurrentDoorState.OPENING ||
      currentDoorState === CurrentDoorState.OPEN) {
    gdo.setCharacteristic(TargetDoorState, TargetDoorState.OPEN);
  } else if (currentDoorState === CurrentDoorState.CLOSING ||
             currentDoorState === CurrentDoorState.CLOSED) {
    gdo.setCharacteristic(TargetDoorState, TargetDoorState.CLOSED);
  }
});
