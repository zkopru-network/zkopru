# Contributing to Zkopru🔒

Thanks for taking a time to read this document. This document includes how to contribute to the project including testing and commits. 

## Table of Content
[Network security vulnerability](#Network-security-vulnerability)
[Commit rule](#Commit-rule)
[Style guide](#Style-guide)
[Recommended Environment](#recommended-environment)
[How to run tests](#how-to-run-tests)
[Packages](#packages)

## Network security vulnerability

After the mainnet stage, you should not open up issues on Github to report bugs that can affect the network's security.
Mostly, it will be the case when you find some bugs in [`packages/contracts`](./packages/contracts) or [`packages/circuits`](./pacakges/circuits).
In this case, please report the bug via [zk-optimistic-rollup@ethereum.org](mailto:zk-optimistic-rollup@ethereum.org) instead of opening a public issue on Github.

## Commit rule

This project follows the conventional commit rule.
To check the full specification, please see [https://www.conventionalcommits.org/](https://www.conventionalcommits.org/)
 Here is the sample commits.
 
1. Commit message with description and breaking change footer

    ```
    feat: allow provided config object to extend other configs
    
    BREAKING CHANGE: `extends` key in config file is now used for extending other config files
    ```
2. Commit message with ! to draw attention to breaking change

    ```
    refactor!: drop support for Node 6
    ```

3. Commit message with both ! and BREAKING CHANGE footer

    ```
    refactor!: drop support for Node 6

    BREAKING CHANGE: refactor to use JavaScript features not available in Node 6.
    ```
4. Commit message with no body

    ```
    docs: correct spelling of CHANGELOG
    ```
5. Commit message with scope

    ```
    feat(lang): add polish language
    ```
6. Commit message with multi-paragraph body and multiple footers

    ```
    fix: correct minor typos in code
    
    see the issue for details
    
    on typos fixed.
    
    Reviewed-by: Z
    Refs #133
    ```

## Style guide

This uses airbnb eslint, and husky will automatically prettify using commit-hook.

## Recommended Environment
## How to run tests
## Packages

