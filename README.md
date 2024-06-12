# gh-list-repos

[![npm version](https://badge.fury.io/js/@ayan4m1%2Fgh-list-repos.svg)](https://badge.fury.io/js/@ayan4m1%2Fgh-list-repos)

## features

- Written in TypeScript
- Small footprint

## requirements

- Node 18+

## installation

> npm i -g @ayan4m1/gh-list-repos

## options

**todo:** document all the options

## usage

> gh-list-repos -u ayan4m1 -v public -n "gh-*-repos"

Will list all public repos for the user `ayan4m1` matching the glob `gh-*-repos`.

> gh-list-repos -o powerprof -v all

Will list all public and private repos belonging to the `powerprof` organization. An authorization token will be obtained interactively if it is not specified with the `-t, --token` option.
