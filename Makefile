# Makefile parameters
BIN_DIR = bin
BUILD_DIR = build
INSTALL_DIR = $(DESTDIR)$(PREFIX)
SRC_DIR = src
SYSTEMD_DIR = systemd
SYSTEMD_INSTALL_DIR = /etc/systemd/system
PREFIX = /usr/local

# the compiler: gcc for C program, define as g++ for C++
CC = gcc

# compiler flags:
CFLAGS = -pthread -Wall
LDFLAGS = -lwiringPi

# meta rules

.PHONY: default
default: build

.PHONY: install
install: installbin installservices


# executable build rules

# generate list of required c binaries
C_BIN = $(notdir $(C_SRC_PATHS))
C_BUILD_PATHS = $(addprefix $(BUILD_DIR)/,$(C_BIN))
C_INSTALL_PATHS = $(addprefix $(INSTALL_DIR)/bin/,$(C_BIN))
C_SRC_PATHS = $(basename $(wildcard $(SRC_DIR)/*.c))

$(BUILD_DIR)/%: $(SRC_DIR)/%.c
	mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

.PHONY: build
build: $(C_BUILD_PATHS)

.PHONY: clean
clean:
	rm -Rf $(BUILD_DIR)


# executable install rules

# generate list of shell scripts
SHELL_BIN = $(notdir $(SHELL_BIN_PATHS))
SHELL_BIN_PATHS = $(wildcard $(BIN_DIR)/*)
SHELL_INSTALL_PATHS = $(addprefix $(INSTALL_DIR)/bin/,$(SHELL_BIN))

$(INSTALL_DIR)/bin/%: $(BUILD_DIR)/%
	mkdir -p $(dir $@)
	cp $^ $@
	sudo chown root:root $@
	sudo chmod u+s $@

$(INSTALL_DIR)/bin/%: $(BIN_DIR)/%
	mkdir -p $(dir $@)
	cp $^ $@
	sudo chown root:root $@
	if systemctl is-enabled $(notdir $@); then systemctl restart $(notdir $@); fi

.PHONY: installbin
installbin: $(C_INSTALL_PATHS) $(SHELL_INSTALL_PATHS)


# service install rules

# generate list of service definitions
SYSTEMD_FILES = $(notdir $(SYSTEMD_FILE_PATHS))
SYSTEMD_FILE_PATHS = $(wildcard $(SYSTEMD_DIR)/*)
SYSTEMD_INSTALL_PATHS = $(addprefix $(SYSTEMD_INSTALL_DIR)/,$(SYSTEMD_FILES))

$(SYSTEMD_INSTALL_DIR)/%: $(SYSTEMD_DIR)/%
	cp $^ $@
	systemctl daemon-reload
	if ! systemctl is-enabled $(notdir $@); then systemctl enable $(notdir $@); fi
	systemctl restart $(notdir $@)

.PHONY: installservices
installservices: $(SYSTEMD_INSTALL_PATHS)
