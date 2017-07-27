# the compiler: gcc for C program, define as g++ for C++
CC = gcc

# compiler flags:
CFLAGS = -pthread -Wall
LIBS = -lwiringPi

all: switch-door door-status

release: all
	sudo chown root:hapadmin switch-door door-status
	sudo chmod u+s switch-door door-status

switch-door: switch-door.c
	$(CC) $(CFLAGS) -o switch-door switch-door.c $(LIBS)

door-status: door-status.c
	$(CC) $(CFLAGS) -o door-status door-status.c $(LIBS)

clean:
	rm door-status switch-door
