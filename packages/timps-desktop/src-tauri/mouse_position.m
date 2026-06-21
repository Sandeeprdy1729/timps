#import <AppKit/AppKit.h>

void cursor_position_get(double *out_x, double *out_y) {
    NSPoint loc = [NSEvent mouseLocation];
    *out_x = loc.x;
    *out_y = loc.y;
}
