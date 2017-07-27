var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var child_process = require("child_process");
var uuid = require('../').uuid;
var util = require("util");

var GARAGE = {
  updateDoorStatus: function(text) {
    // Get raw switch values from GPIO
    var doorStatusRegex = /TOP (\d) BOTTOM (\d)/;
    var doorStatusValues = doorStatusRegex.exec(text);
    var topSensorState = Number(doorStatusValues[1]);
    var bottomSensorState = Number(doorStatusValues[2]);

    if (topSensorState === 1 && bottomSensorState === 0) {
      GARAGE.status = Characteristic.CurrentDoorState.CLOSED;
      GARAGE.lastRestingStatus = Characteristic.CurrentDoorState.CLOSED;
      garage
        .getService(Service.GarageDoorOpener)
        .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
    } else if (topSensorState === 0 && bottomSensorState === 1) {
      GARAGE.status = Characteristic.CurrentDoorState.OPEN;
      GARAGE.lastRestingStatus = Characteristic.CurrentDoorState.OPEN;
      garage
        .getService(Service.GarageDoorOpener)
        .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
    } else if (topSensorState === 1 && bottomSensorState === 1) {
      if (GARAGE.lastRestingStatus === Characteristic.CurrentDoorState.CLOSED) {
        GARAGE.status = Characteristic.CurrentDoorState.OPENING;
        garage
          .getService(Service.GarageDoorOpener)
          .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
      } else if (GARAGE.lastRestingStatus === Characteristic.CurrentDoorState.OPEN) {
        GARAGE.status = Characteristic.CurrentDoorState.CLOSING;
        garage
          .getService(Service.GarageDoorOpener)
          .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED );
      } else {
        GARAGE.status = Characteristic.CurrentDoorState.STOPPED;
        garage
          .getService(Service.GarageDoorOpener)
          .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.OPEN);
      }
    } else {
      console.log("Unknown sensor state - both circuits closed");
      return
    }

    garage.getService(Service.GarageDoorOpener)
          .setCharacteristic(Characteristic.CurrentDoorState, GARAGE.status);
    switch (GARAGE.status) {
      case Characteristic.CurrentDoorState.OPEN:
        console.log("Door currently open");
        break;
      case Characteristic.CurrentDoorState.CLOSED:
        console.log("Door currently closed");
        break;
      case Characteristic.CurrentDoorState.OPENING:
        console.log("Door currently opening");
        break;
      case Characteristic.CurrentDoorState.CLOSING:
        console.log("Door currently closing");
        break;
      case Characteristic.CurrentDoorState.STOPPED:
        console.log("Door currently stopped");
        break;
      default:
        console.log("Door state unknown");
    }
    console.log();
  },
  switch: function() {
    child_process.execSync("~/gdoor/switch-door");
  },
  open: function() {
    switch (GARAGE.status) {
      case Characteristic.CurrentDoorState.OPEN:
        console.log("Garage already open");
        break;
      case Characteristic.CurrentDoorState.OPENING:
        console.log("Garage already opening");
        break;
      case Characteristic.CurrentDoorState.CLOSED:
        console.log("Opening the Garage!");
        GARAGE.switch();
        break;
      case Characteristic.CurrentDoorState.CLOSING:
        console.log("Opening the Garage!");
        GARAGE.switch();
        setTimeout(GARAGE.switch, 2000);
        break;
      case Characteristic.CurrentDoorState.STOPPED:
        console.log("Starting the Garage!");
        GARAGE.switch();
        setTimeout(function() {
          if (GARAGE.status !== Characteristic.CurrentDoorState.OPEN ||
              GARAGE.status !== Characteristic.CurrentDoorState.OPENING) {
            console.log("Door is going in wrong direction - reversing");
            GARAGE.switch();
            setTimeout(GARAGE.switch, 2000);
          }
        }, 2000);
        break;
      default:
        console.log("Unknown door state - will try switching");
        GARAGE.switch();
    }
  },
  close: function() {
    switch (GARAGE.status) {
      case Characteristic.CurrentDoorState.OPEN:
        console.log("Closing the Garage!");
        GARAGE.switch();
        break;
      case Characteristic.CurrentDoorState.OPENING:
        console.log("Closing the Garage!");
        GARAGE.switch();
        setTimeout(GARAGE.switch, 2000);
        break;
      case Characteristic.CurrentDoorState.CLOSED:
        console.log("Garage already closed");
        break;
      case Characteristic.CurrentDoorState.CLOSING:
        console.log("Garage already closing");
        break;
      case Characteristic.CurrentDoorState.STOPPED:
        console.log("Starting the Garage!");
        GARAGE.switch();
        setTimeout(function() {
          if (GARAGE.status !== Characteristic.CurrentDoorState.CLOSED ||
              GARAGE.status !== Characteristic.CurrentDoorState.CLOSING) {
            console.log("Door is going in wrong direction - reversing");
            GARAGE.switch();
            setTimeout(GARAGE.switch, 2000);
          }
        }, 2000);
        break;
      default:
        console.log("Unknown door state - will try switching");
        GARAGE.switch();
    }
  },
  identify: function() {
    //add your code here which allows the garage to be identified
    console.log("Identify the Garage");
  }
};

var doorStatus = child_process.spawn("/home/hapadmin/gdoor/door-status", ["-w"]);
doorStatus.stdout.on('data', function(data) {
  GARAGE.updateDoorStatus(data);
});
doorStatus.stderr.on('data', function(data) {
  console.log(data);
});

var garageUUID = uuid.generate('hap-nodejs:accessories:'+'GarageDoor');
var garage = exports.accessory = new Accessory('Garage Door', garageUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
garage.username = "dc:44:6d:6d:6f:d8"; //edit this if you use Core.js
garage.pincode = "582-73-289";

garage
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Chamberlain")
  .setCharacteristic(Characteristic.Model, "Merlin Professional MT60P");

garage.on('identify', function(paired, callback) {
  GARAGE.identify();
  callback();
});

garage
  .addService(Service.GarageDoorOpener, "Garage Door")
  .getCharacteristic(Characteristic.TargetDoorState)
  .on('set', function(value, callback) {

    if (value == Characteristic.TargetDoorState.CLOSED) {
      GARAGE.close();
      callback();
    } else if (value == Characteristic.TargetDoorState.OPEN) {
      GARAGE.open();
      callback();
    }
  });

var initialDoorStatusData = child_process.execSync("/home/hapadmin/gdoor/door-status");
GARAGE.updateDoorStatus(initialDoorStatusData);
garage
  .getService(Service.GarageDoorOpener)
  .setCharacteristic(Characteristic.TargetDoorState,
    GARAGE.status === Characteristic.CurrentDoorState.CLOSED
      ? Characteristic.TargetDoorState.CLOSED
      : Characteristic.TargetDoorState.OPEN)

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
