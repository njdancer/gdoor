#include <wiringPi.h>

// Pin to trigger for identify command(30 = STAT-LED)
#define IDENTIFY_PIN 30
// Delay between LED state transition
#define BLINK_DELAY 500
// Number of full cycles of LED
#define BLINK_REPEAT 8

int main(void)
{
  // This needs to be called before accessing GPIO
  wiringPiSetup();
  pinMode(IDENTIFY_PIN, OUTPUT);

  for (int i = 0; i < BLINK_REPEAT; i++) {
    // Turn LED on and off with delays between
    digitalWrite(IDENTIFY_PIN, HIGH);
    delay(BLINK_DELAY);
    digitalWrite(IDENTIFY_PIN, LOW);
    delay(BLINK_DELAY);
  }

  return 0;
}
