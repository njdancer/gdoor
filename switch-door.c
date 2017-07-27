#include <wiringPi.h>

#define GARAGE_DOOR 7
#define SWITCH_DELAY 100

int main(void)
{
	wiringPiSetup();

	pinMode(GARAGE_DOOR, OUTPUT);

	digitalWrite(GARAGE_DOOR, LOW);
	delay(SWITCH_DELAY);
	digitalWrite(GARAGE_DOOR, HIGH);

	return 0;
}
