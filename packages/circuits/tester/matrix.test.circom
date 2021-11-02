template Multiplier() {
    signal input a;
    signal input b;
    signal output c;
    c <== a*b;
}

template MatrixMultiplier(m, n, p) {
    signal input a[m][n];
    signal input b[n][p];
    signal input ab[m][p];
    component intermediates[m][p][n];
    for(var row = 0; row < m; row++) {
      for(var col = 0; col < p; col++) {
        var sum = 0;
        for(var i = 0; i < n; i++) {
          intermediates[row][col][i] = Multiplier();
          intermediates[row][col][i].a <== a[row][i];
          intermediates[row][col][i].b <== b[i][col];
          sum = sum + intermediates[row][col][i].c
        }
        ab[row][col] === sum; 
      }
    }
}
component main = MatrixMultiplier(2, 3, 4); 