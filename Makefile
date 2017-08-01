# the compiler: gcc for C program, define as g++ for C++
CC = gcc

# compiler flags:
CFLAGS = -pthread -Wall
LIBS = -lwiringPi

all: door-status identify switch-door

release: all
	sudo chown root:hapadmin door-status identify switch-door
	sudo chmod u+s door-status identify switch-door


door-status: door-status.c
	$(CC) $(CFLAGS) -o door-status door-status.c $(LIBS)

identify: identify.c
	$(CC) $(CFLAGS) -o identify identify.c $(LIBS)

switch-door: switch-door.c
	$(CC) $(CFLAGS) -o switch-door switch-door.c $(LIBS)


clean:
	rm door-status identify switch-door
