/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

export type LogLevel =
  | 'ALL'
  | 'TRACE'
  | 'DEBUG'
  | 'INFO'
  | 'WARN'
  | 'ERROR'
  | 'FATAL'
  | 'OFF';

export type AdditionalLogFilesProvider = {
  getAdditionalLogFiles(): Promise<Array<AdditionalLogFile>>,
};

export type AdditionalLogFile = {
  title: string, // usually a filepath
  data: string,
};
