#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
#include <unistd.h>
#include <limits.h>
#include <wiringPi.h>

#define TOP_SENSOR 5
#define BOTTOM_SENSOR 4

volatile int doorStatus = 0;

void printDoorStatus(void) {
// DO NOT CHANGE - FORMAT RELIED UPON BY HAP-NODEJS
  printf("TOP %d BOTTOM %d\n", digitalRead(TOP_SENSOR), digitalRead(BOTTOM_SENSOR));
}

int main(int argc, char **argv) {
  int watchFlag = 0;
  int c;

  // force stdout to be output immediately and not buffered
  setbuf(stdout, NULL);

  // sets up the wiringPi library
  if (wiringPiSetup () < 0) {
      fprintf (stderr, "Unable to setup wiringPi: %s\n", strerror (errno));
      return 1;
  }

  // connect both sensors to pull-up resistor
  pinMode(TOP_SENSOR, INPUT);
  pullUpDnControl(TOP_SENSOR, PUD_UP);
  pinMode(BOTTOM_SENSOR, INPUT);
  pullUpDnControl(BOTTOM_SENSOR, PUD_UP);

  // set both pins to interupt during any transition
  if ( wiringPiISR (TOP_SENSOR, INT_EDGE_BOTH, &printDoorStatus) < 0 ) {
      fprintf (stderr, "Unable to setup ISR for top sensor: %s\n", strerror (errno));
      return 2;
  }
  if ( wiringPiISR (BOTTOM_SENSOR, INT_EDGE_BOTH, &printDoorStatus) < 0 ) {
      fprintf (stderr, "Unable to setup ISR for bottom sensor: %s\n", strerror (errno));
      return 3;
  }

  while ((c = getopt (argc, argv, "w")) != -1)
  {
    switch (c)
    {
      case 'w':
        watchFlag = 1;
        break;
      case '?':
        fprintf (stderr, "Unknown option character `\\x%x'.\n", optopt);
        return 4;
      default:
        abort();
    }
  }

  if (watchFlag) {
    // wait for interrupts
    while(1) {
      sleep(UINT_MAX); // wait indefinitely
    }
  } else {
    printDoorStatus();
  }

  return 0;
}
